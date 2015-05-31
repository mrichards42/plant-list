"""Download and parse a plant list from USDA"""

import csv
import urllib2
import json
import logging

logger = logging.getLogger(__name__)


JSON_FILE = 'assets/json/all_plants.json'
ALABAMA = "US01"
TALL_COUNTIES = ["AL:007", "AL:065", "AL:125"]

URL = r"http://plants.usda.gov/java/AdvancedSearchServlet?sciname=*&county=AL:125&Synonyms=all&viewby=sciname&dsp_vernacular=on&dsp_genus=on&dsp_family=on&dsp_famcomname=on&dsp_familySym=on&dsp_grwhabt=on&dsp_dur=on&download=on"

# Mapping USDA fields to our fields
KEYS = {
    "Accepted Symbol": "code",
    "Scientific Name": "scientific",
    "Common Name": "common",
    "Genus": "genus",
    "Family": "family",
    "Family Symbol": "familyCode",
    "Family Common Name": "familyCommon",
    "Duration": "duration",
    "Growth Habit": "growth"
}

# Keys to save for synonym plants
SYNONYM_KEYS = {
    "Synonym Symbol": "code",
    "Scientific Name": "scientific",
}

# Keys that should be a list
SPLIT_KEYS = ["growth", "duration"]

def make_plant(row, mapping):
    """Return a plant dictionary after converting from USDA fields"""
    plant = {}
    for key, newKey in mapping.iteritems():
        plant[newKey] = row[key]
    return plant

def is_var_or_ssp(scientific):
    return ' var. ' in scientific or ' ssp. ' in scientific

def get_plants(state=None, counties=None, codelist=False):
    """Get plants from USDA and return a list
    
    state is a FIPS code (e.g. US01)
    counties is a list of counties (e.g. ["AL:007", "AL:065"])
    if codelist is True, just return a list of codes
    
    format:
    [
        {
            "code": "CODE",
            "scientific": "Scientific name",
            "common": "Common name",
            "genus": "Genus",
            "family": "Family",
            "familyCode": "FAMILYCODE",
            "familyCommon": "Family common name",
            "growth": ["Tree", "Shrub", etc...],
            "duration": ["Annual", "Perennial", etc...],
            "synonyms": [
                { "code": "CODE", "scientific": "Scientific name" },
                ...
            ]
        },
        ...
    ]

    synonyms will not appear in the main list
    
    """
    # Download CSV file from USDA
    # ---------------------------
    url = URL
    assert state or counties, "Must filter by state or counties"
    if state:
        url = url + "&statefips=" + state
    elif counties:
        for county in counties:
            url = url + "&county=" + county
    logger.info("Downloading plants from %r" % url)
    f = urllib2.urlopen(url)
    logger.info("Done.")

    # Parse and combine synonyms
    # --------------------------
    plants = []
    plants_by_code = {}
    plants_by_scientific = {}
    reader = csv.DictReader(f)
    nrows = 0
    logger.info("Parsing file")
    variety_count = 0
    variety_map = {} # variety code -> normal code
    for row in reader:
        code = row['Accepted Symbol']
        synonym = row['Synonym Symbol']
        scientific = row['Scientific Name']
        # Filter varieties
        if is_var_or_ssp(scientific):
            # Add to variety_map
            if not synonym:
                species = ' '.join(scientific.split()[:2])
                variety_map[code] = plants_by_scientific[species]['code']
            variety_count += 1
            continue
        # Add synonym plants to existing plants
        if synonym:
            plant = make_plant(row, SYNONYM_KEYS)
            accepted = plants_by_code.get(code)
            if not accepted:
                accepted = plants_by_code.get(variety_map[code])
            accepted['synonyms'].append(plant)
        # Add plant
        else:
            plant = make_plant(row, KEYS)
            plant['synonyms'] = []
            # Replace growth habits
            plant['growth'] = plant['growth'].replace('Forb/herb', 'Forb').replace('Subshrub', 'Shrub')
            # Split
            for key in SPLIT_KEYS:
                values = [val for val in plant[key].split(', ') if val]
                # Remove duplicates
                plant[key] = []
                for v in values:
                    if v not in plant[key]:
                        plant[key].append(v)
            plants.append(plant)
            plants_by_code[code] = plant
            plants_by_scientific[scientific] = plant
        nrows += 1
    logger.info("Done: got %d plants and %d synonyms" % (len(plants), nrows - len(plants)))
    logger.info("Removed %d varieties and subspecies" % variety_count)

    if codelist:
        return [plant['code'] for plant in plants]
    else:
        return plants

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    #plants = get_plants(state=ALABAMA)
    plants = get_plants(counties=TALL_COUNTIES)
    with open(JSON_FILE, 'wb') as f:
        json.dump(plants, f)
    logger.info('Wrote to %r' % JSON_FILE)
