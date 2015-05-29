"""Download and parse a plant list from USDA"""

import csv
import urllib2
import json

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

def get_plants(state=None, counties=None):
    """Get plants from USDA and return a list
    
    state is a FIPS code (e.g. US01)
    counties is a list of counties (e.g. ["AL:007", "AL:065"])
    
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
    print "Downloading plants from\n%r\n..." % url
    f = urllib2.urlopen(url)
    print "Done."

    # Parse and combine synonyms
    # --------------------------
    plants = []
    plants_by_code = {}
    reader = csv.DictReader(f)
    nrows = 0
    print "Parsing file",
    for row in reader:
        code = row['Accepted Symbol']
        synonym = row['Synonym Symbol']
        # Add synonym plants to existing plants
        if synonym:
            plant = make_plant(row, SYNONYM_KEYS)
            plants_by_code[code]['synonyms'].append(plant)
        # Add plant
        else:
            plant = make_plant(row, KEYS)
            plant['synonyms'] = []
            # Replace "Forb/herb" with "Forb"
            plant['growth'] = plant['growth'].replace('Forb/herb', 'Forb')
            # Add "sp." to genera
            if plant['scientific'] == plant['genus']:
                plant['scientific'] += ' sp.'
            # Split
            for key in SPLIT_KEYS:
                plant[key] = [val for val in plant[key].split(', ') if val]
            plants.append(plant)
            plants_by_code[code] = plant
        nrows += 1
        if nrows % 500 == 0:
            print ".",
    print
    print "Done: got %d plants and %d synonyms" % (len(plants), nrows - len(plants))

    # Remove varieties and subspecies
    # -------------------------------
    filtered = [plant for plant in plants if len(plant['scientific'].split()) <= 2]
    print "Removed %d varieties and subspecies" % (len(plants) - len(filtered))

    return filtered

if __name__ == '__main__':
    #plants = get_plants(state=ALABAMA)
    plants = get_plants(counties=TALL_COUNTIES)
    with open(JSON_FILE, 'wb') as f:
        json.dump(plants, f)
    print 'Wrote to %r' % JSON_FILE
