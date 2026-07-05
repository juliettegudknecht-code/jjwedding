if (window.IDEA) { /* already loaded */ } else { (function(){
/* ============================================================
   IDEA Section 618 - data + palette
   All figures are the exact reported numbers from the U.S.
   Department of Education (OSEP) / NCES, lifted verbatim from
   the original data tool. Counts in the time series are in
   THOUSANDS unless noted; DEMO/COLL are exact head counts.
   ============================================================ */

/* ---- USAFacts-style palette --------------------------------- */
const PAL = {
  cream:  '#f4f3ee', // warm off-white page
  card:   '#fbfbf8',
  ink:    '#1b1b16',  // near-black headline
  muted:  '#63645c',  // subtitles
  faint:  '#94958c',  // source notes / axis
  line:   '#e4e3da',  // gridlines / hairlines
  greenD: '#103d2c',  // forest - primary
  green:  '#2f8f57',  // leaf-ish medium green
  greenL: '#7cc08a',  // light green
  sage:   '#c7d6c4',  // de-emphasised fill
  blue:   '#2a5fb0',  // muted federal blue
  purple: '#7a4fa3',  // muted purple
  accent: '#cf6b35',  // calmer clay-orange highlight (autism)
  navy:   '#10324a',  // federal navy (chrome + reference marks)
  gray:   '#c9c8be',  // muted/context series
};

/* ---- National time series ----------------------------------- */
const YEARS = ['1976-77','1980-81','1990-91','2000-01','2008-09','2009-10','2010-11','2011-12','2012-13','2013-14','2014-15','2015-16','2016-17','2017-18','2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25'];

// Total children & students served under IDEA Part B, ages 3-21 (thousands)
const ALL = [3694,4144,4710,6296,6483,6481,6436,6401,6429,6464,6555,6677,6802,6964,7134,7282,7214,7353,7630,7892,8194];

// Served as a percent of public-school enrollment (last two years not yet published)
const ENROLL_PCT = [8.3,10.1,11.4,13.3,13.2,13.1,13.0,12.9,12.9,12.9,13.0,13.2,13.4,13.7,14.1,14.3,14.5,14.7,15.2,null,null];

// Per primary disability category, thousands, aligned to YEARS
const DIS = {
  'Specific learning disability':[796,1462,2129,2860,2476,2431,2361,2303,2277,2264,2278,2298,2318,2342,2368,2405,2320,2352,2407,2446,2517],
  'Speech or language impairment':[1302,1168,985,1388,1426,1416,1396,1373,1356,1334,1332,1337,1337,1357,1378,1374,1362,1389,1441,1483,1494],
  'Other health impairment':[141,98,55,303,659,689,716,743,779,817,862,909,955,1002,1049,1094,1110,1139,1174,1211,1249],
  'Autism':[null,null,null,93,336,378,417,455,498,538,576,617,661,710,762,803,829,889,990,1100,1219],
  'Developmental delay':[null,null,null,213,354,368,382,393,402,410,419,434,446,461,479,502,480,484,519,560,606],
  'Intellectual disability':[961,830,534,624,478,463,448,435,430,425,423,425,431,436,439,442,415,419,427,426,419],
  'Emotional disturbance':[283,347,389,480,420,407,390,373,362,354,349,347,348,353,358,365,346,328,321,318,311],
  'Multiple disabilities':[null,68,96,131,130,131,130,132,133,132,132,131,132,132,133,133,128,126,127,128,162],
  'Hearing impairment':[88,79,58,77,78,79,78,78,77,77,76,75,75,75,74,73,71,71,70,68,67],
  'Orthopedic impairment':[87,58,49,82,70,65,63,61,59,56,52,47,42,41,39,37,33,32,31,29,28],
  'Traumatic brain injury':[null,null,null,16,26,25,26,26,26,26,26,27,27,27,27,27,25,25,25,24,24],
  'Visual impairment':[38,31,23,29,29,29,28,28,28,28,28,27,27,27,27,27,25,26,25,24,24],
  'Deaf-blindness':[null,3,1,1,2,2,2,2,1,1,1,1,1,1,2,2,2,2,2,2,2],
};

/* ---- Educational environments (school-age, thousands) ------- */
const ENV_LBL = ['2012-13','2013-14','2014-15','2015-16','2016-17','2017-18','2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25'];
const ENV = {
  'Inside regular class 80% or more of the day':[3482,3542,3622,3708,3800,3913,4040,4248,4441,4587,4760,4951,5170],
  'Inside regular class 40% through 79% of the day':[1122,1113,1101,1110,1121,1130,1137,1149,1100,1103,1114,1103,1123],
  'Inside regular class less than 40% of the day':[794,794,795,808,811,819,828,842,842,863,890,907,948],
  'Separate School':[169,167,170,169,173,172,173,177,177,166,168,170,175],
  'Residential Facility':[19,18,17,16,16,15,14,14,13,11,11,11,11],
  'Parentally Placed in Private Schools':[68,62,78,84,82,88,89,95,111,118,122,130,131],
  'Homebound / Hospital':[22,23,23,23,23,23,24,24,21,26,24,25,25],
  'Correctional Facilities':[16,15,14,12,12,11,11,10,7,7,8,8,8],
};

// Inclusion by disability, 2024-25 school-age: [in regular class 80%+, total]
const INCL = {
  'Speech or language impairment':[1165608,1309525],
  'Specific learning disability':[1983527,2516690],
  'Other health impairment':[894998,1234765],
  'Developmental delay':[227847,328961],
  'Emotional disturbance':[180952,310855],
  'Autism':[452819,1111435],
  'Multiple disabilities':[38776,157588],
  'Intellectual disability':[87399,416534],
  'Hearing impairment':[41281,62472],
  'Orthopedic impairment':[15532,25638],
  'Traumatic brain injury':[12071,23570],
  'Visual impairment':[16288,22870],
  'Deaf-blindness':[521,1679],
};

/* ---- States: [name, abbr, 2000-01, 2010-11, 2022-23, 2024-25, %enroll 2022-23] */
const STATES = [
  ['Alabama','AL',99828,82286,99921,108142,13.3],['Alaska','AK',17691,18048,19368,20578,14.8],
  ['Arizona','AZ',96442,125816,149811,156856,13.2],['Arkansas','AR',62222,64881,80226,82245,16.3],
  ['California','CA',645287,672174,805289,870993,13.6],['Colorado','CO',78715,84710,113289,121001,13.0],
  ['Connecticut','CT',73886,68167,88635,94417,17.3],['Delaware','DE',16760,18608,27502,29243,19.4],
  ['District of Columbia','DC',10559,11947,15126,17431,16.6],['Florida','FL',367335,368808,432391,449221,15.1],
  ['Georgia','GA',171292,177544,230363,241754,13.2],['Hawaii','HI',23951,19716,19920,20572,11.7],
  ['Idaho','ID',29174,27388,38298,40914,12.1],['Illinois','IL',297316,302830,295261,311046,15.9],
  ['Indiana','IN',156320,166073,188078,199266,18.2],['Iowa','IA',72461,68501,71801,72623,14.0],
  ['Kansas','KS',61267,66873,81063,82375,16.6],['Kentucky','KY',94572,102370,109749,116650,16.6],
  ['Louisiana','LA',97938,82943,96916,92103,13.5],['Maine','ME',35633,32261,35828,37579,20.6],
  ['Maryland','MD',112077,103490,114732,123169,12.9],['Massachusetts','MA',162216,167526,182105,194876,19.7],
  ['Michigan','MI',221456,218957,199856,212730,13.9],['Minnesota','MN',109880,122850,151845,164717,17.5],
  ['Mississippi','MS',62281,64038,69280,72004,15.7],['Missouri','MO',137381,127164,127376,131648,14.3],
  ['Montana','MT',19313,16761,21112,21546,14.0],['Nebraska','NE',42793,44299,55212,57496,16.8],
  ['Nevada','NV',38160,48148,64032,69397,13.2],['New Hampshire','NH',30077,29920,30917,32324,18.3],
  ['New Jersey','NJ',221715,232002,243035,258870,17.6],['New Mexico','NM',52256,46628,56195,60536,17.8],
  ['New York','NY',441333,454542,524993,558587,20.7],['North Carolina','NC',173067,185107,202310,218031,13.1],
  ['North Dakota','ND',13652,13170,17654,18381,14.9],['Ohio','OH',237643,259454,278916,294438,16.6],
  ['Oklahoma','OK',85577,97250,120920,127130,17.2],['Oregon','OR',75204,81050,87648,92570,15.2],
  ['Pennsylvania','PA',242655,295080,357917,384878,21.1],['Rhode Island','RI',30727,25332,24650,26854,17.9],
  ['South Carolina','SC',105922,100289,112142,114284,14.2],['South Dakota','SD',16825,18026,23232,24353,16.4],
  ['Tennessee','TN',125863,120263,132339,140731,13.1],['Texas','TX',491642,442019,703058,852699,12.7],
  ['Utah','UT',53921,70278,91715,96308,13.3],['Vermont','VT',13623,13936,15471,16354,18.5],
  ['Virginia','VA',162212,162338,177836,189235,14.1],['Washington','WA',118851,127978,151949,165762,13.9],
  ['West Virginia','WV',50333,45007,46973,50234,18.7],['Wisconsin','WI',125358,124722,125334,130106,15.2],
  ['Wyoming','WY',13154,15348,16352,16559,17.7],
];

/* ---- Demographics, 2024-25 (exact head counts) -------------- */
/* Only the two profiles the story uses are kept: the All-Disabilities
   total and Autism. Each has totals, sex, race and single-year ages. */
const DEMO = {
  'All Disabilities': {
    total:8194424, female:2895304, male:5295440,
    race:{ White:3520522, Hispanic:2481393, Black:1377394, Multi:449007, Asian:243717, AIAN:94401, NHPI:28132 },
    ages:{3:206675,4:322159,5:423917,6:503187,7:560214,8:615298,9:648426,10:660322,11:627983,12:595976,13:571789,14:550577,15:549332,16:538389,17:490968,18:211328,19:60035,20:35823,21:22026},
  },
  'Autism': {
    total:1218821, female:226785, male:884002,
    race:{ White:465025, Hispanic:377329, Black:208816, Asian:82457, Multi:71158, AIAN:8906, NHPI:4475 },
    ages:{3:37355,4:57205,5:92293,6:103850,7:104315,8:100007,9:93522,10:87797,11:79819,12:76278,13:71488,14:67366,15:64550,16:61534,17:56037,18:29709,19:15430,20:12120,21:8146},
  },
};
/* Exact race/ethnicity category names as they appear in the OSEP/EdFacts file
   specifications (IDEA Part B Child Count file spec C002/C089). */
const RACE_LBL = { White:'White', Hispanic:'Hispanic/Latino', Black:'Black or African American', Multi:'Two or more races', Asian:'Asian', AIAN:'American Indian or Alaska Native', NHPI:'Native Hawaiian or Other Pacific Islander' };

/* ---- Other collections, latest year ------------------------- */
const PARTC = { year:'2024-25', total:458920, settings:{ 'Home':406921, 'Community-based setting':35999, 'Other setting':16000 } };
const EXITING = { year:'2023-24', 'Graduated, regular diploma':367002, 'Moved, still enrolled':145394, 'Transferred to regular ed':73780, 'Dropped out':60258, 'Received a certificate':41015, 'Reached maximum age':4846, 'Graduated, alternate diploma':2473, 'Died':1630 };
const ASSESS = { year:'2023-24', mathProf:17.2, readProf:19.0 };

/* ---- 47th Annual Report to Congress (ARC), 2025 ------------- *
   Authoritative national figures, fall 2023 child count / 2022-23
   exiting, quoted from the report's Section I summary and exhibits.
   These anchor the snapshot scenes so prose and charts agree.       */
const ARC = {
  schoolAgeTotal: 7236548,      // students ages 5 (school age) through 21, fall 2023
  ages6to21: 6900750,           // ages 6 through 21, fall 2023 (50 states + DC + BIE)
  earlyChildhoodTotal: 583341,  // children ages 3 through 5, fall 2023
  partcTotal: 458920,           // infants & toddlers birth through age 2, School Year 2024-25

  // share of school-age students served, by category, fall 2023 (Exhibit 21)
  catShare: [
    ['Specific learning disability', 33.8],
    ['Speech or language impairment', 17.9],
    ['Other health impairment', 16.5],
    ['Autism', 13.8],
    ['Other disabilities combined', 7.7],
    ['Intellectual disability', 5.8],
    ['Emotional disturbance', 4.4],
  ],

  // educated inside the regular class 80% or more of the day, by category, fall 2023 (Exhibit 31)
  inclByCat: [
    ['Speech or language impairment', 88.7],
    ['Specific learning disability', 77.8],
    ['Other health impairment', 71.7],
    ['Visual impairment', 70.9],
    ['Developmental delay', 69.4],
    ['All disabilities', 67.7],
    ['Hearing impairment', 65.8],
    ['Orthopedic impairment', 60.3],
    ['Emotional disturbance', 56.9],
    ['Traumatic brain injury', 51.6],
    ['Autism', 40.7],
    ['Deaf-blindness', 31.1],
    ['Intellectual disability', 20.3],
    ['Multiple disabilities', 16.2],
  ],

  env2023: { in80: 67.8, in40: 15.1, in0: 12.4, other: 4.7 },
  envTrend: { fromYear: '2019', from: 64.8, toYear: '2023', to: 67.8 },

  partcSettings: [['Home', 88.7], ['Community-based setting', 7.8], ['Other setting', 3.5]],  // SY 2024-25 (Home 406,921 / Community 35,999 / Other 16,000 of 458,920)

  exit: { year: '2022\u201323', prevYear: '2014\u201315',
    gradDiplomaPct: 75.8, dropoutPct: 13.9, gradPrev: 66.1, dropoutPrev: 18.4,
    totalExited: 677871, gradRegularCount: 358869, gradRegularSharePct: 52.9 },

  earlyChildhoodCat: [['Developmental delay', 45.0], ['Speech or language impairment', 31.7], ['Autism', 17.5]],
};

/* ---- Derived helpers ---------------------------------------- */
const D = {
  // school-age environment total per year (sum of the 8 settings)
  envTotal: ENV_LBL.map((_, i) => Object.values(ENV).reduce((s, a) => s + a[i], 0)),
  // inclusion share (% in regular class 80%+) per year
  inclShare: null,
  // latest non-null enrollment %
  latestEnrollPct: ENROLL_PCT.filter(v => v != null).pop(),
};
D.inclShare = ENV_LBL.map((_, i) => +(ENV['Inside regular class 80% or more of the day'][i] / D.envTotal[i] * 100).toFixed(1));

// number formatting
const nf = n => n == null ? '–' : n.toLocaleString('en-US');
const pct = n => (n == null ? '–' : n.toFixed(n % 1 === 0 ? 0 : 1) + '%');
// compact: 8,194,424 -> "8.2 million"; 458,920 -> "458,920"
function compactNum(n){
  if (n >= 1e6) return +(n/1e6).toFixed(n >= 1e7 ? 0 : 1) + ' million';
  return n.toLocaleString('en-US');
}

window.IDEA = { PAL, YEARS, ALL, ENROLL_PCT, DIS, ENV_LBL, ENV, INCL, STATES, DEMO, RACE_LBL, PARTC, EXITING, ASSESS, ARC, D, nf, pct, compactNum };

})(); }