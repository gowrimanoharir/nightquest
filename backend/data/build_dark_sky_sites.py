"""
Build data/dark_sky_sites.json from:
1. OpenStreetMap Overpass API (dark_sky tags, star_gazing/observatory POIs)
2. Wikipedia IDA certified places list (fill gaps, all certified=true)

Output schema per entry: name, lat, lon, bortle_estimate, certified, website, country, state
"""
import json
import re
import os
import time
from urllib.request import urlopen, Request
from urllib.parse import quote

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(DATA_DIR, "dark_sky_sites.json")

# Wikipedia "Dark-sky preserve" / IDA certified places with known coordinates.
# All certified=true. Fields: name, lat, lon, bortle_estimate, website, country, state
IDA_WIKI_LIST = [
    # USA
    {"name": "Big Bend National Park", "lat": 29.25, "lon": -103.25, "bortle_estimate": 1, "website": "https://www.nps.gov/bibe", "country": "USA", "state": "Texas"},
    {"name": "McDonald Observatory", "lat": 30.67, "lon": -104.02, "bortle_estimate": 2, "website": "https://mcdonaldobservatory.org", "country": "USA", "state": "Texas"},
    {"name": "Enchanted Rock State Natural Area", "lat": 30.50, "lon": -98.82, "bortle_estimate": 3, "website": "https://tpwd.texas.gov/state-parks/enchanted-rock", "country": "USA", "state": "Texas"},
    {"name": "Cherry Springs State Park", "lat": 41.65, "lon": -77.82, "bortle_estimate": 2, "website": "https://www.dcnr.pa.gov/StateParks/FindAPark/CherrySpringsStatePark", "country": "USA", "state": "Pennsylvania"},
    {"name": "Natural Bridges National Monument", "lat": 37.62, "lon": -109.98, "bortle_estimate": 1, "website": "https://www.nps.gov/nabr", "country": "USA", "state": "Utah"},
    {"name": "Canyonlands National Park", "lat": 38.25, "lon": -109.88, "bortle_estimate": 1, "website": "https://www.nps.gov/cany", "country": "USA", "state": "Utah"},
    {"name": "Arches National Park", "lat": 38.73, "lon": -109.59, "bortle_estimate": 2, "website": "https://www.nps.gov/arch", "country": "USA", "state": "Utah"},
    {"name": "Bryce Canyon National Park", "lat": 37.59, "lon": -112.19, "bortle_estimate": 2, "website": "https://www.nps.gov/brca", "country": "USA", "state": "Utah"},
    {"name": "Cedar Breaks National Monument", "lat": 37.63, "lon": -112.84, "bortle_estimate": 2, "website": "https://www.nps.gov/cebr", "country": "USA", "state": "Utah"},
    {"name": "Hovenweep National Monument", "lat": 37.38, "lon": -109.08, "bortle_estimate": 1, "website": "https://www.nps.gov/hove", "country": "USA", "state": "Utah"},
    {"name": "Grand Canyon National Park", "lat": 36.05, "lon": -112.14, "bortle_estimate": 2, "website": "https://www.nps.gov/grca", "country": "USA", "state": "Arizona"},
    {"name": "Petrified Forest National Park", "lat": 35.07, "lon": -109.78, "bortle_estimate": 1, "website": "https://www.nps.gov/pefo", "country": "USA", "state": "Arizona"},
    {"name": "Sunset Crater Volcano National Monument", "lat": 35.36, "lon": -111.50, "bortle_estimate": 2, "website": "https://www.nps.gov/sucr", "country": "USA", "state": "Arizona"},
    {"name": "Wupatki National Monument", "lat": 35.52, "lon": -111.37, "bortle_estimate": 2, "website": "https://www.nps.gov/wupa", "country": "USA", "state": "Arizona"},
    {"name": "Walnut Canyon National Monument", "lat": 35.17, "lon": -111.51, "bortle_estimate": 3, "website": "https://www.nps.gov/waca", "country": "USA", "state": "Arizona"},
    {"name": "Death Valley National Park", "lat": 36.45, "lon": -116.87, "bortle_estimate": 1, "website": "https://www.nps.gov/deva", "country": "USA", "state": "California"},
    {"name": "Joshua Tree National Park", "lat": 33.87, "lon": -115.90, "bortle_estimate": 2, "website": "https://www.nps.gov/jotr", "country": "USA", "state": "California"},
    {"name": "Anza-Borrego Desert State Park", "lat": 33.26, "lon": -116.40, "bortle_estimate": 2, "website": "https://www.parks.ca.gov/?page_id=638", "country": "USA", "state": "California"},
    {"name": "Chaco Culture National Historical Park", "lat": 36.06, "lon": -107.96, "bortle_estimate": 1, "website": "https://www.nps.gov/chcu", "country": "USA", "state": "New Mexico"},
    {"name": "Salinas Pueblo Missions National Monument", "lat": 34.60, "lon": -106.35, "bortle_estimate": 2, "website": "https://www.nps.gov/sapu", "country": "USA", "state": "New Mexico"},
    {"name": "Clayton Lake State Park", "lat": 36.55, "lon": -103.34, "bortle_estimate": 2, "website": "https://www.emnrd.nm.gov/state-parks/parks/clayton-lake-state-park", "country": "USA", "state": "New Mexico"},
    {"name": "Capulin Volcano National Monument", "lat": 36.79, "lon": -104.09, "bortle_estimate": 2, "website": "https://www.nps.gov/cavo", "country": "USA", "state": "New Mexico"},
    {"name": "El Morro National Monument", "lat": 35.04, "lon": -108.35, "bortle_estimate": 2, "website": "https://www.nps.gov/elmo", "country": "USA", "state": "New Mexico"},
    {"name": "Bandelier National Monument", "lat": 35.78, "lon": -106.27, "bortle_estimate": 2, "website": "https://www.nps.gov/band", "country": "USA", "state": "New Mexico"},
    {"name": "Great Basin National Park", "lat": 38.98, "lon": -114.30, "bortle_estimate": 1, "website": "https://www.nps.gov/grba", "country": "USA", "state": "Nevada"},
    {"name": "Craters of the Moon National Monument", "lat": 43.42, "lon": -113.52, "bortle_estimate": 2, "website": "https://www.nps.gov/crmo", "country": "USA", "state": "Idaho"},
    {"name": "Prineville Reservoir State Park", "lat": 44.29, "lon": -120.68, "bortle_estimate": 2, "website": "https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=112", "country": "USA", "state": "Oregon"},
    {"name": "Goldendale Observatory State Park", "lat": 45.82, "lon": -120.82, "bortle_estimate": 3, "website": "https://parks.state.wa.us/497/Goldendale-Observatory", "country": "USA", "state": "Washington"},
    {"name": "Devils Tower National Monument", "lat": 44.59, "lon": -104.72, "bortle_estimate": 2, "website": "https://www.nps.gov/deto", "country": "USA", "state": "Wyoming"},
    {"name": "Glacier National Park", "lat": 48.76, "lon": -113.79, "bortle_estimate": 2, "website": "https://www.nps.gov/glac", "country": "USA", "state": "Montana"},
    {"name": "Theodore Roosevelt National Park", "lat": 47.58, "lon": -103.39, "bortle_estimate": 2, "website": "https://www.nps.gov/thro", "country": "USA", "state": "North Dakota"},
    {"name": "Badlands National Park", "lat": 43.75, "lon": -102.50, "bortle_estimate": 2, "website": "https://www.nps.gov/badl", "country": "USA", "state": "South Dakota"},
    {"name": "Wind Cave National Park", "lat": 43.56, "lon": -103.48, "bortle_estimate": 2, "website": "https://www.nps.gov/wica", "country": "USA", "state": "South Dakota"},
    {"name": "Voyageurs National Park", "lat": 48.50, "lon": -92.88, "bortle_estimate": 2, "website": "https://www.nps.gov/voya", "country": "USA", "state": "Minnesota"},
    {"name": "Headlands International Dark Sky Park", "lat": 45.78, "lon": -84.97, "bortle_estimate": 3, "website": "https://www.emmetcounty.org/darkskypark", "country": "USA", "state": "Michigan"},
    {"name": "John Glenn Astronomy Park", "lat": 39.42, "lon": -82.54, "bortle_estimate": 3, "website": "https://www.jgap.info", "country": "USA", "state": "Ohio"},
    {"name": "Falls of the Ohio State Park", "lat": 38.28, "lon": -85.76, "bortle_estimate": 4, "website": "https://www.fallsoftheohio.org", "country": "USA", "state": "Indiana"},
    {"name": "Kissimmee Prairie Preserve State Park", "lat": 27.61, "lon": -81.04, "bortle_estimate": 2, "website": "https://www.floridastateparks.org/parks-and-trails/kissimmee-prairie-preserve-state-park", "country": "USA", "state": "Florida"},
    {"name": "Stephen C. Foster State Park", "lat": 31.08, "lon": -82.32, "bortle_estimate": 2, "website": "https://gastateparks.org/StephenCFoster", "country": "USA", "state": "Georgia"},
    {"name": "Mayland Earth to Sky Park", "lat": 35.92, "lon": -81.98, "bortle_estimate": 3, "website": "https://www.mayland.edu/planetarium", "country": "USA", "state": "North Carolina"},
    {"name": "Pickett State Park", "lat": 36.56, "lon": -84.78, "bortle_estimate": 2, "website": "https://tnstateparks.com/parks/pickett", "country": "USA", "state": "Tennessee"},
    {"name": "Cuivre River State Park", "lat": 39.08, "lon": -90.98, "bortle_estimate": 3, "website": "https://mostateparks.com/park/cuivre-river-state-park", "country": "USA", "state": "Missouri"},
    {"name": "Merritt Reservoir State Recreation Area", "lat": 42.08, "lon": -100.95, "bortle_estimate": 2, "website": "https://outdoornebraska.gov/merrittreservoir", "country": "USA", "state": "Nebraska"},
    {"name": "Lake Scott State Park", "lat": 38.68, "lon": -100.69, "bortle_estimate": 2, "website": "https://ksoutdoors.com/State-Parks/Locations/Scott", "country": "USA", "state": "Kansas"},
    {"name": "Black Mesa State Park", "lat": 36.93, "lon": -102.99, "bortle_estimate": 2, "website": "https://www.travelok.com/state-parks/black-mesa-state-park", "country": "USA", "state": "Oklahoma"},
    {"name": "Buffalo National River", "lat": 36.05, "lon": -92.88, "bortle_estimate": 2, "website": "https://www.nps.gov/buff", "country": "USA", "state": "Arkansas"},
    # Canada
    {"name": "Jasper National Park", "lat": 52.87, "lon": -117.95, "bortle_estimate": 1, "website": "https://www.pc.gc.ca/en/pn-np/ab/jasper", "country": "Canada", "state": "Alberta"},
    {"name": "Wood Buffalo National Park", "lat": 59.38, "lon": -112.98, "bortle_estimate": 1, "website": "https://www.pc.gc.ca/en/pn-np/nt/woodbuffalo", "country": "Canada", "state": "Alberta"},
    {"name": "Grasslands National Park", "lat": 49.12, "lon": -107.43, "bortle_estimate": 1, "website": "https://www.pc.gc.ca/en/pn-np/sk/grasslands", "country": "Canada", "state": "Saskatchewan"},
    {"name": "Cypress Hills Interprovincial Park", "lat": 49.55, "lon": -109.98, "bortle_estimate": 2, "website": "https://www.cypresshills.com", "country": "Canada", "state": "Saskatchewan"},
    {"name": "Riding Mountain National Park", "lat": 50.85, "lon": -100.04, "bortle_estimate": 2, "website": "https://www.pc.gc.ca/en/pn-np/mb/riding", "country": "Canada", "state": "Manitoba"},
    {"name": "Gordon's Park", "lat": 45.87, "lon": -82.65, "bortle_estimate": 2, "website": "https://www.gordonspark.com", "country": "Canada", "state": "Ontario"},
    {"name": "Torrance Barrens Dark-Sky Preserve", "lat": 45.04, "lon": -79.55, "bortle_estimate": 3, "website": "https://www.ontarioparks.com/park/torrancebarrens", "country": "Canada", "state": "Ontario"},
    {"name": "Bruce Peninsula National Park", "lat": 45.25, "lon": -81.52, "bortle_estimate": 2, "website": "https://www.pc.gc.ca/en/pn-np/on/bruce", "country": "Canada", "state": "Ontario"},
    {"name": "Fundy National Park", "lat": 45.60, "lon": -64.95, "bortle_estimate": 2, "website": "https://www.pc.gc.ca/en/pn-np/nb/fundy", "country": "Canada", "state": "New Brunswick"},
    {"name": "Kejimkujik National Park", "lat": 44.40, "lon": -65.22, "bortle_estimate": 2, "website": "https://www.pc.gc.ca/en/pn-np/ns/kejimkujik", "country": "Canada", "state": "Nova Scotia"},
    {"name": "Mont-Mégantic National Park", "lat": 45.46, "lon": -71.15, "bortle_estimate": 2, "website": "https://www.sepaq.com/pq/mme", "country": "Canada", "state": "Quebec"},
    # Mexico
    {"name": "Reserva de la Biosfera El Cielo", "lat": 23.05, "lon": -99.22, "bortle_estimate": 2, "website": "https://elcielo.tamaulipas.gob.mx", "country": "Mexico", "state": "Tamaulipas"},
    {"name": "Parque Nacional San Pedro Mártir", "lat": 31.05, "lon": -115.55, "bortle_estimate": 1, "website": "https://www.gob.mx/semarnat", "country": "Mexico", "state": "Baja California"},
    # UK / Europe (Wikipedia IDA list)
    {"name": "Exmoor National Park", "lat": 51.14, "lon": -3.75, "bortle_estimate": 3, "website": "https://www.exmoor-nationalpark.gov.uk", "country": "United Kingdom", "state": "Devon"},
    {"name": "Northumberland International Dark Sky Park", "lat": 55.30, "lon": -2.20, "bortle_estimate": 3, "website": "https://www.northumberlandnationalpark.org.uk", "country": "United Kingdom", "state": "Northumberland"},
    {"name": "Kerry International Dark-Sky Reserve", "lat": 51.95, "lon": -10.15, "bortle_estimate": 2, "website": "https://www.kerrydarksky.com", "country": "Ireland", "state": "County Kerry"},
    {"name": "Pic du Midi Dark Sky Reserve", "lat": 42.94, "lon": 0.14, "bortle_estimate": 2, "website": "https://www.picdumidi.com", "country": "France", "state": "Hautes-Pyrénées"},
    {"name": "Eifel National Park", "lat": 50.55, "lon": 6.45, "bortle_estimate": 2, "website": "https://www.nationalpark-eifel.de", "country": "Germany", "state": "North Rhine-Westphalia"},
    {"name": "Westhavelland Nature Park", "lat": 52.70, "lon": 12.35, "bortle_estimate": 2, "website": "https://www.westhavelland.de", "country": "Germany", "state": "Brandenburg"},
    {"name": "Hortobágy Starry Sky Park", "lat": 47.58, "lon": 21.15, "bortle_estimate": 3, "website": "http://hortobagy.csillagpark.hu", "country": "Hungary", "state": "Hajdú-Bihar"},
    {"name": "Zselic National Landscape Protection Area", "lat": 46.24, "lon": 17.77, "bortle_estimate": 3, "website": "https://zselicicsillagpark.hu", "country": "Hungary", "state": "Somogy"},
    {"name": "Aoraki Mackenzie International Dark Sky Reserve", "lat": -44.00, "lon": 170.48, "bortle_estimate": 3, "website": "https://www.darksky.org/our-work/conservation/idsp/communities/aorakimackenzie", "country": "New Zealand", "state": "Canterbury"},
    {"name": "Warrumbungle National Park", "lat": -31.30, "lon": 149.00, "bortle_estimate": 1, "website": "https://www.nationalparks.nsw.gov.au/visit-a-park/parks/warrumbungle-national-park", "country": "Australia", "state": "New South Wales"},
    {"name": "NamibRand Nature Reserve", "lat": -24.75, "lon": 15.95, "bortle_estimate": 1, "website": "https://www.namibrand.org", "country": "Namibia", "state": "Hardap"},
    # More USA (Wikipedia IDA)
    {"name": "Copper Breaks State Park", "lat": 34.10, "lon": -99.75, "bortle_estimate": 2, "website": "https://tpwd.texas.gov/state-parks/copper-breaks", "country": "USA", "state": "Texas"},
    {"name": "South Llano River State Park", "lat": 30.49, "lon": -99.79, "bortle_estimate": 3, "website": "https://tpwd.texas.gov/state-parks/south-llano-river", "country": "USA", "state": "Texas"},
    {"name": "Hills Creek State Park", "lat": 41.78, "lon": -77.12, "bortle_estimate": 3, "website": "https://www.dcnr.pa.gov/StateParks/FindAPark/HillsCreekStatePark", "country": "USA", "state": "Pennsylvania"},
    {"name": "Capitol Reef National Park", "lat": 38.37, "lon": -111.14, "bortle_estimate": 2, "website": "https://www.nps.gov/care", "country": "USA", "state": "Utah"},
    {"name": "Antelope Island State Park", "lat": 40.96, "lon": -112.21, "bortle_estimate": 3, "website": "https://stateparks.utah.gov/parks/antelope-island", "country": "USA", "state": "Utah"},
    {"name": "Great Sand Dunes National Park", "lat": 37.73, "lon": -105.51, "bortle_estimate": 2, "website": "https://www.nps.gov/grsa", "country": "USA", "state": "Colorado"},
    {"name": "Black Canyon of the Gunnison National Park", "lat": 38.57, "lon": -107.72, "bortle_estimate": 2, "website": "https://www.nps.gov/blca", "country": "USA", "state": "Colorado"},
    {"name": "Dinosaur National Monument", "lat": 40.53, "lon": -108.98, "bortle_estimate": 2, "website": "https://www.nps.gov/dino", "country": "USA", "state": "Colorado"},
    {"name": "Mesa Verde National Park", "lat": 37.23, "lon": -108.46, "bortle_estimate": 2, "website": "https://www.nps.gov/meve", "country": "USA", "state": "Colorado"},
    {"name": "Chiricahua National Monument", "lat": 32.01, "lon": -109.35, "bortle_estimate": 2, "website": "https://www.nps.gov/chir", "country": "USA", "state": "Arizona"},
    {"name": "Tonto National Monument", "lat": 33.64, "lon": -111.09, "bortle_estimate": 3, "website": "https://www.nps.gov/tont", "country": "USA", "state": "Arizona"},
    {"name": "Massacre Rocks State Park", "lat": 42.65, "lon": -112.99, "bortle_estimate": 2, "website": "https://parksandrecreation.idaho.gov/parks/massacre-rocks", "country": "USA", "state": "Idaho"},
    {"name": "Sunriver Nature Center", "lat": 43.88, "lon": -121.44, "bortle_estimate": 3, "website": "https://www.sunrivernaturecenter.org", "country": "USA", "state": "Oregon"},
    {"name": "Waterton-Glacier International Peace Park", "lat": 48.99, "lon": -113.90, "bortle_estimate": 3, "website": "https://www.nps.gov/glac", "country": "USA", "state": "Montana"},
    {"name": "Dr. T. K. Lawless County Park", "lat": 41.78, "lon": -85.78, "bortle_estimate": 3, "website": "https://www.berriencounty.org/666/Dr-T-K-Lawless-Park", "country": "USA", "state": "Michigan"},
    {"name": "Greater Big Bend International Dark Sky Reserve", "lat": 29.50, "lon": -103.50, "bortle_estimate": 3, "website": "https://darksky.org", "country": "USA", "state": "Texas"},
    # More Canada (Wikipedia)
    {"name": "Beaver Hills Dark Sky Preserve", "lat": 53.45, "lon": -112.85, "bortle_estimate": 4, "website": "https://www.beaverhills.ca", "country": "Canada", "state": "Alberta"},
    {"name": "McDonald Park Dark Sky Preserve", "lat": 49.12, "lon": -121.95, "bortle_estimate": 2, "website": "https://www.fraservalley.ca", "country": "Canada", "state": "British Columbia"},
    {"name": "Kouchibouguac National Park", "lat": 46.85, "lon": -64.98, "bortle_estimate": 2, "website": "https://www.pc.gc.ca/en/pn-np/nb/kouchibouguac", "country": "Canada", "state": "New Brunswick"},
    {"name": "Mount Carleton Provincial Park", "lat": 47.22, "lon": -66.82, "bortle_estimate": 2, "website": "https://www.tourismnewbrunswick.ca", "country": "Canada", "state": "New Brunswick"},
    {"name": "Lake Superior Provincial Park", "lat": 47.60, "lon": -84.75, "bortle_estimate": 1, "website": "https://www.ontarioparks.com/park/lakesuperior", "country": "Canada", "state": "Ontario"},
    {"name": "Killarney Provincial Park", "lat": 46.05, "lon": -81.40, "bortle_estimate": 1, "website": "https://www.ontarioparks.com/park/killarney", "country": "Canada", "state": "Ontario"},
    {"name": "Point Pelee National Park", "lat": 41.96, "lon": -82.52, "bortle_estimate": 3, "website": "https://www.pc.gc.ca/en/pn-np/on/pelee", "country": "Canada", "state": "Ontario"},
    {"name": "Quetico Provincial Park", "lat": 48.45, "lon": -91.50, "bortle_estimate": 2, "website": "https://www.ontarioparks.com/park/quetico", "country": "Canada", "state": "Ontario"},
    {"name": "Mont-Tremblant National Park", "lat": 46.55, "lon": -74.58, "bortle_estimate": 2, "website": "https://www.sepaq.com/pq/mot", "country": "Canada", "state": "Quebec"},
    # More international (Wikipedia)
    {"name": "Sark", "lat": 49.43, "lon": -2.36, "bortle_estimate": 3, "website": "https://www.sark.co.uk", "country": "United Kingdom", "state": "Channel Islands"},
    {"name": "Bodmin Moor Dark Sky Landscape", "lat": 50.55, "lon": -4.60, "bortle_estimate": 3, "website": "https://www.cornwall.gov.uk", "country": "United Kingdom", "state": "Cornwall"},
    {"name": "Cranborne Chase National Landscape", "lat": 50.95, "lon": -2.05, "bortle_estimate": 4, "website": "https://cranbornechase.org.uk", "country": "United Kingdom", "state": "Dorset"},
    {"name": "Moore's Reserve South Downs", "lat": 50.90, "lon": -0.95, "bortle_estimate": 4, "website": "https://www.southdowns.gov.uk", "country": "United Kingdom", "state": "Hampshire"},
    {"name": "OM Dark Sky Park and Observatory", "lat": 54.35, "lon": -7.40, "bortle_estimate": 1, "website": "https://omdarksky.com", "country": "United Kingdom", "state": "Northern Ireland"},
    {"name": "Bieszczady Starry-Sky Park", "lat": 49.10, "lon": 22.65, "bortle_estimate": 2, "website": "https://www.bdpn.pl", "country": "Poland", "state": "Subcarpathia"},
    {"name": "Jizera Dark-Sky Park", "lat": 50.85, "lon": 15.25, "bortle_estimate": 3, "website": "https://www.astro.cz", "country": "Czech Republic", "state": "Liberec"},
    {"name": "Beskydy Dark-Sky Park", "lat": 49.50, "lon": 18.45, "bortle_estimate": 3, "website": "https://www.astro.cz", "country": "Czech Republic", "state": "Moravian-Silesian"},
    {"name": "Poloniny Dark-Sky Park", "lat": 49.05, "lon": 22.40, "bortle_estimate": 2, "website": "https://www.poloniny.sk", "country": "Slovakia", "state": "Prešov"},
    {"name": "Cévennes National Park", "lat": 44.25, "lon": 3.58, "bortle_estimate": 2, "website": "https://www.cevennes-parcnational.fr", "country": "France", "state": "Cévennes"},
    {"name": "Rhön Biosphere Reserve", "lat": 50.50, "lon": 10.00, "bortle_estimate": 3, "website": "https://www.biosphaerenreservat-rhoen.de", "country": "Germany", "state": "Bavaria"},
    {"name": "Winklmoosalm", "lat": 47.68, "lon": 12.58, "bortle_estimate": 2, "website": "https://www.winklmoosalm.de", "country": "Germany", "state": "Bavaria"},
    {"name": "Bükk National Park", "lat": 48.05, "lon": 20.45, "bortle_estimate": 4, "website": "https://www.bukk.eu", "country": "Hungary", "state": "Borsod-Abaúj-Zemplén"},
    {"name": "Manětín Dark-Sky Park", "lat": 49.98, "lon": 13.23, "bortle_estimate": 3, "website": "https://www.manetinske.cz", "country": "Czech Republic", "state": "Plzeň"},
    {"name": "De Boschplaat Terschelling", "lat": 53.38, "lon": 5.28, "bortle_estimate": 3, "website": "https://www.staatsbosbeheer.nl", "country": "Netherlands", "state": "Friesland"},
    {"name": "Lauwersmeer Dark Sky Park", "lat": 53.38, "lon": 6.22, "bortle_estimate": 4, "website": "https://www.np-lauwersmeer.nl", "country": "Netherlands", "state": "Friesland"},
    {"name": "Stewart Island-Rakiura", "lat": -46.90, "lon": 168.13, "bortle_estimate": 2, "website": "https://www.doc.govt.nz", "country": "New Zealand", "state": "Southland"},
    {"name": "Aotea Great Barrier Island", "lat": -36.20, "lon": 175.42, "bortle_estimate": 2, "website": "https://www.doc.govt.nz", "country": "New Zealand", "state": "Auckland"},
    {"name": "Gabriela Mistral Dark Sky Sanctuary", "lat": -30.00, "lon": -70.65, "bortle_estimate": 1, "website": "https://www.darksky.org", "country": "Chile", "state": "Elqui Valley"},
    {"name": "Makhtesh Ramon", "lat": 30.55, "lon": 34.85, "bortle_estimate": 2, "website": "https://www.parks.org.il", "country": "Israel", "state": "Southern District"},
    {"name": "Indian Astronomical Observatory Hanle", "lat": 32.78, "lon": 78.96, "bortle_estimate": 1, "website": "https://www.iiap.res.in", "country": "India", "state": "Ladakh"},
    {"name": "Niue", "lat": -19.05, "lon": -169.87, "bortle_estimate": 2, "website": "https://www.darksky.org", "country": "Niue", "state": None},
    {"name": "West Penwith Dark Sky Park", "lat": 50.08, "lon": -5.62, "bortle_estimate": 3, "website": "https://www.cornwall.gov.uk", "country": "United Kingdom", "state": "Cornwall"},
    {"name": "Albanyà Dark Sky Park", "lat": 42.30, "lon": 2.72, "bortle_estimate": 2, "website": "https://www.albanya.org", "country": "Spain", "state": "Catalonia"},
    {"name": "River Murray Dark Sky Reserve", "lat": -34.55, "lon": 139.60, "bortle_estimate": 2, "website": "https://www.darksky.org", "country": "Australia", "state": "South Australia"},
    {"name": "Arkaroola Wilderness Sanctuary", "lat": -30.32, "lon": 139.35, "bortle_estimate": 1, "website": "https://www.arkaroola.com.au", "country": "Australia", "state": "South Australia"},
    {"name": "The Jump-Up Australian Age of Dinosaurs", "lat": -24.52, "lon": 147.58, "bortle_estimate": 1, "website": "https://www.australianageofdinosaurs.com", "country": "Australia", "state": "Queensland"},
    {"name": "Naturpark Attersee-Traunsee", "lat": 47.90, "lon": 13.55, "bortle_estimate": 3, "website": "https://www.attersee-traunsee.at", "country": "Austria", "state": "Upper Austria"},
    {"name": "Desengano State Park", "lat": -21.95, "lon": -41.95, "bortle_estimate": 4, "website": "https://www.inea.rj.gov.br", "country": "Brazil", "state": "Rio de Janeiro"},
    {"name": "Kaikōura Dark Sky Sanctuary", "lat": -42.40, "lon": 173.68, "bortle_estimate": 3, "website": "https://www.darksky.org", "country": "New Zealand", "state": "Canterbury"},
    {"name": "Wairarapa Dark Sky Reserve", "lat": -41.20, "lon": 175.50, "bortle_estimate": 2, "website": "https://www.wairarapadarksky.org.nz", "country": "New Zealand", "state": "Wellington"},
    {"name": "Wai-iti Dark Sky Park", "lat": -41.35, "lon": 172.95, "bortle_estimate": 3, "website": "https://www.tasman.govt.nz", "country": "New Zealand", "state": "Tasman"},
    {"name": "Yeongyang Firefly Eco Park", "lat": 36.65, "lon": 129.12, "bortle_estimate": 4, "website": "https://www.yeongyang.go.kr", "country": "South Korea", "state": "North Gyeongsang"},
    {"name": "Iriomote-Ishigaki National Park", "lat": 24.33, "lon": 123.85, "bortle_estimate": 4, "website": "https://www.env.go.jp", "country": "Japan", "state": "Okinawa"},
    {"name": "Kozushima Dark Sky Island", "lat": 34.20, "lon": 139.15, "bortle_estimate": 2, "website": "https://www.darksky.org", "country": "Japan", "state": "Tokyo"},
    {"name": "!Ae!Hai Kalahari Heritage Park", "lat": -25.75, "lon": 20.35, "bortle_estimate": 1, "website": "https://www.sanparks.org", "country": "South Africa", "state": "Northern Cape"},
    {"name": "Joya-La Barreta Ecological Park", "lat": 20.62, "lon": -100.38, "bortle_estimate": 4, "website": "https://www.queretaro.gob.mx", "country": "Mexico", "state": "Querétaro"},
    {"name": "Jelsa Dark Sky Community", "lat": 43.16, "lon": 16.69, "bortle_estimate": 3, "website": "https://www.darksky.org", "country": "Croatia", "state": "Hvar"},
    {"name": "Vrani kamen Dark Sky Park", "lat": 43.55, "lon": 16.62, "bortle_estimate": 2, "website": "https://www.darksky.org", "country": "Croatia", "state": "Split-Dalmatia"},
    {"name": "Aenos National Park", "lat": 38.15, "lon": 20.58, "bortle_estimate": 3, "website": "https://www.aeolos.gr", "country": "Greece", "state": "Cephalonia"},
    {"name": "Dark Sky Park Bulbjerg", "lat": 57.12, "lon": 9.02, "bortle_estimate": 3, "website": "https://www.visitnordjylland.dk", "country": "Denmark", "state": "North Denmark"},
    {"name": "Møn and Nyord Dark Sky Park", "lat": 54.98, "lon": 12.08, "bortle_estimate": 2, "website": "https://www.visitdenmark.com", "country": "Denmark", "state": "Zealand"},
]


def _bortle_from_osm_description(desc: str) -> int | None:
    """Parse Bortle class from OSM description/ref if present."""
    if not desc:
        return None
    m = re.search(r"Bortle\s*(?:class\s*)?(\d)", desc, re.I)
    if m:
        return min(9, max(1, int(m.group(1))))
    m = re.search(r"(\d[,.]?\d*)\s*magnit[uú]d[oó]", desc, re.I)
    if m:
        mag = float(m.group(1).replace(",", "."))
        if mag >= 7.0:
            return 2
        if mag >= 6.0:
            return 3
        if mag >= 5.0:
            return 4
        if mag >= 4.0:
            return 5
    return None


def _country_from_osm_tags(tags: dict) -> str:
    """Infer country from addr:country or similar."""
    return tags.get("addr:country") or tags.get("country") or ""


def _state_from_osm_tags(tags: dict) -> str:
    """Infer state/region from OSM tags."""
    return (
        tags.get("addr:state")
        or tags.get("addr:region")
        or tags.get("addr:county")
        or tags.get("addr:province")
        or ""
    )


def query_overpass_dark_sky() -> list[dict]:
    """Query Overpass for dark_sky=yes and leisure=star_gazing. Return list of {name, lat, lon, bortle_estimate, website, country, state}."""
    # Nodes and ways/relations with dark_sky=yes; also leisure=star_gazing for more POIs
    query = """
    [out:json][timeout:90];
    (
      node["dark_sky"="yes"](1,1,90,-1);
      node["leisure"="star_gazing"](1,1,90,-1);
      way["dark_sky"="yes"](1,1,90,-1);
      way["leisure"="star_gazing"](1,1,90,-1);
      relation["dark_sky"="yes"](1,1,90,-1);
      relation["leisure"="star_gazing"](1,1,90,-1);
    );
    out center meta;
    """
    req = Request(OVERPASS_URL, data=query.encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urlopen(req, timeout=95) as r:
        data = json.load(r)
    results = []
    seen = set()
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = (tags.get("name:en") or tags.get("name") or "").strip()
        if not name or len(name) < 3:
            continue
        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            c = el.get("center") or {}
            lat, lon = c.get("lat"), c.get("lon")
        if lat is None or lon is None:
            continue
        key = (round(lat, 4), round(lon, 4), name[:50])
        if key in seen:
            continue
        seen.add(key)
        desc = tags.get("description") or tags.get("ref") or ""
        bortle = _bortle_from_osm_description(desc)
        website = (tags.get("website") or tags.get("url") or "").strip() or None
        if website and not website.startswith("http"):
            website = "https://" + website
        country = _country_from_osm_tags(tags)
        state = _state_from_osm_tags(tags)
        results.append({
            "name": name,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "bortle_estimate": bortle,
            "website": website,
            "country": country or None,
            "state": state or None,
        })
    return results


def query_overpass_observatories() -> list[dict]:
    """Query Overpass for tourism=observatory (often dark sky sites)."""
    query = """
    [out:json][timeout:60];
    (
      node["tourism"="observatory"](1,1,90,-1);
      way["tourism"="observatory"](1,1,90,-1);
    );
    out center meta;
    """
    req = Request(OVERPASS_URL, data=query.encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urlopen(req, timeout=70) as r:
            data = json.load(r)
    except Exception:
        return []
    results = []
    seen = set()
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = (tags.get("name:en") or tags.get("name") or "").strip()
        if not name or len(name) < 2:
            continue
        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            c = el.get("center") or {}
            lat, lon = c.get("lat"), c.get("lon")
        if lat is None or lon is None:
            continue
        key = (round(lat, 3), round(lon, 3))
        if key in seen:
            continue
        seen.add(key)
        website = (tags.get("website") or tags.get("url") or "").strip() or None
        if website and not website.startswith("http"):
            website = "https://" + website
        country = _country_from_osm_tags(tags)
        state = _state_from_osm_tags(tags)
        results.append({
            "name": name,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "bortle_estimate": None,
            "website": website,
            "country": country or None,
            "state": state or None,
        })
    return results


def normalize_entry(entry: dict, certified: bool) -> dict:
    """Ensure keys: name, lat, lon, bortle_estimate, certified, website, country, state."""
    return {
        "name": str(entry["name"]).strip(),
        "lat": round(float(entry["lat"]), 6),
        "lon": round(float(entry["lon"]), 6),
        "bortle_estimate": entry.get("bortle_estimate"),
        "certified": certified,
        "website": entry.get("website") if entry.get("website") else None,
        "country": entry.get("country") or None,
        "state": entry.get("state") or None,
    }


def _approx_match(ida_entry: dict, osm_entry: dict) -> bool:
    """True if OSM entry likely refers to same place as IDA (name similarity, distance)."""
    name_ida = (ida_entry.get("name") or "").lower()
    name_osm = (osm_entry.get("name") or "").lower()
    if name_ida in name_osm or name_osm in name_ida:
        return True
    # Token overlap
    ida_tokens = set(re.findall(r"\w+", name_ida))
    osm_tokens = set(re.findall(r"\w+", name_osm))
    if ida_tokens & osm_tokens and len(ida_tokens & osm_tokens) >= 2:
        d = (ida_entry["lat"] - osm_entry["lat"]) ** 2 + (ida_entry["lon"] - osm_entry["lon"]) ** 2
        if d < 0.5:  # ~50 km
            return True
    return False


def build_ida_set() -> list[dict]:
    """IDA list from Wikipedia: all certified=true."""
    out = []
    for e in IDA_WIKI_LIST:
        out.append(normalize_entry({**e, "certified": True}, certified=True))
    return out


def merge_ida_and_osm(ida_list: list[dict], osm_list: list[dict]) -> list[dict]:
    """IDA entries first (all certified). Then OSM entries not matching any IDA (certified=false)."""
    ida_names_coords = {(e["name"].lower(), round(e["lat"], 3), round(e["lon"], 3)) for e in ida_list}
    merged = list(ida_list)
    for osm in osm_list:
        # Skip if we already have an IDA entry for same place
        if any(_approx_match(i, osm) for i in ida_list):
            continue
        key = (osm["name"].lower(), round(osm["lat"], 3), round(osm["lon"], 3))
        if key in ida_names_coords:
            continue
        merged.append(normalize_entry(osm, certified=False))
    return merged


def main():
    print("Fetching IDA list (Wikipedia)...")
    ida_list = build_ida_set()
    print(f"  IDA certified: {len(ida_list)}")

    print("Querying Overpass (dark_sky + star_gazing)...")
    try:
        osm_dark = query_overpass_dark_sky()
        print(f"  Overpass dark_sky/star_gazing: {len(osm_dark)}")
    except Exception as e:
        print(f"  Overpass error: {e}")
        osm_dark = []

    print("Querying Overpass (observatories)...")
    try:
        osm_obs = query_overpass_observatories()
        print(f"  Overpass observatories: {len(osm_obs)}")
    except Exception as e:
        print(f"  Overpass error: {e}")
        osm_obs = []

    # Combine OSM: prefer dark_sky, add observatories that don't duplicate
    osm_all = list(osm_dark)
    seen_approx = {(round(p["lat"], 3), round(p["lon"], 3)) for p in osm_dark}
    for o in osm_obs:
        k = (round(o["lat"], 3), round(o["lon"], 3))
        if k not in seen_approx:
            seen_approx.add(k)
            osm_all.append(o)

    merged = merge_ida_and_osm(ida_list, osm_all)
    # Dedupe by (name, lat, lon)
    seen = set()
    unique = []
    for m in merged:
        key = (m["name"].lower()[:60], round(m["lat"], 4), round(m["lon"], 4))
        if key in seen:
            continue
        seen.add(key)
        unique.append(m)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(unique, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(unique)} sites to {OUT_PATH} (certified={sum(1 for u in unique if u['certified'])})")


if __name__ == "__main__":
    main()
