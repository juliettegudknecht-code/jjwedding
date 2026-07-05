if (window.IDISC) { /* already loaded */ } else { (function () {
/* ============================================================
   IDEA 618 - discipline, exiting-by-category and separation data
   Figures adapted from the "Disability Dots" data story, which
   computed them from the public federal files. Sources:
   - IDEA Part B Discipline Collection, 2023-24 (removal counts
     and rates per 100 students served).
   - U.S. Dept. of Education, Office for Civil Rights, Civil
     Rights Data Collection (CRDC), 2020-21 (share of disciplined
     children who have a disability, vs their share of enrollment).
   - IDEA Part B Exiting Collection, 2023-24, ages 14-21,
     50 states and DC. Shares are of students who LEFT school;
     students who moved or returned to regular education are not
     counted as leavers.
   - IDEA Part B Educational Environments, 2024-25, school-age:
     percent of each category in a regular class less than 40% of
     the day ("mostly separated"). The matching "mostly included"
     percents are computed at runtime from window.IDEA.INCL.
   ============================================================ */

var IDISC = {
  removals: {
    year: '2023-24',
    totalLabel: '2.24 million',   // disciplinary removals of students with disabilities in the year
    paceLabel: 'about one every 2 seconds of the school day',
    autismCount: 141126,          // removals of students served under autism
    // [category, removals per 100 students served]
    per100: [
      ['Emotional disturbance', 112],
      ['Other health impairment', 51],
      ['Specific learning disability', 32],
      ['All disabilities', 27],
      ['Autism', 12]
    ]
  },
  crdc: {
    year: '2020-21',
    pre: { enroll: 24, punished: 62, label: 'Preschool: expelled',
      word: 'preschoolers expelled have a disability',
      note: 'If discipline matched enrollment, 24 of these 100 children would have a disability. Instead 62 do, about 2.6 times their share, the widest gap in school discipline.' },
    oss: { enroll: 14, punished: 24, label: 'K-12: out-of-school suspension',
      word: 'students given an out-of-school suspension have a disability',
      note: 'Students with disabilities are 14% of K-12 enrollment, but 24 of every 100 students suspended out of school, about 1.7 times their share.' },
    iss: { enroll: 14, punished: 18, label: 'K-12: in-school suspension',
      word: 'students given an in-school suspension have a disability',
      note: 'Students with disabilities are 14% of K-12 enrollment, but 18 of every 100 students suspended in school, about 1.3 times their share.' }
  },
  exitYear: '2023-24',
  exitLabels: ['Graduated with a regular diploma', 'Received a certificate', 'Dropped out', 'Aged out or other'],
  exitByCat: {
    'All disabilities': [76.9, 9.1, 12.6, 1.4],
    'Specific learning disability': [83.6, 4.4, 11.8, 0.3],
    'Speech or language impairment': [88.4, 2.3, 8.8, 0.4],
    'Other health impairment': [80.7, 5.2, 13.4, 0.7],
    'Autism': [72.3, 18.1, 6.4, 3.3],
    'Emotional disturbance': [67.8, 5.2, 26.2, 0.8],
    'Intellectual disability': [46.4, 35.7, 12.7, 5.2]
  },
  // % of school-age students in a regular class less than 40% of the day, 2024-25
  sepByCat: {
    'Speech or language impairment': 3.1,
    'Specific learning disability': 2.8,
    'All disabilities': 12.4,
    'Emotional disturbance': 12.4,
    'Autism': 35.0,
    'Intellectual disability': 44.4
  }
};

window.IDISC = IDISC;
})(); }
