// ---------- constants ----------
const REGIONS = ['chest', 'arms', 'core', 'glutes', 'legs']
const AB = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const MEAS = ['underbust', 'bust', 'waist', 'hips', 'arm', 'thigh']
const LIMITS = { height: [50, 230], weight: [20, 300], bodyfat: [4, 70], underbust: [40, 200], bust: [45, 250], waist: [30, 250], hips: [45, 250], arm: [15, 70], thigh: [30, 110] }
const LABEL = { height: 'Height', weight: 'Weight', bodyfat: 'Body fat', underbust: 'Underbust', bust: 'Bust', waist: 'Waist', hips: 'Hips', arm: 'Upper arm', thigh: 'Thigh', gland: 'Glandular tissue', sag: 'Sag', potential: 'Glandular potential' }
const UNIT = { height: 'cm', weight: 'kg', bodyfat: '%', underbust: 'cm', bust: 'cm', waist: 'cm', hips: 'cm', arm: 'cm', thigh: 'cm', gland: 'cc each', sag: '', potential: 'cc each' }
const STAT_KEYS = Object.keys(LIMITS).concat(AB, ['gland', 'sag', 'potential'])
const RWORD = { chest: 'chest', arms: 'arms', core: 'midsection', glutes: 'glutes', legs: 'legs' }
const MUS_START = { chest: 2.0, arms: 3.2, core: 3.5, glutes: 3.8, legs: 9.5 }   // kg at 60 kg body weight
const PATTERNS = {
  pear: { chest: .12, arms: .12, core: .22, glutes: .24, legs: .30 },
  apple: { chest: .16, arms: .12, core: .38, glutes: .16, legs: .18 },
  even: { chest: .20, arms: .20, core: .20, glutes: .20, legs: .20 }
}
// cm change per kg of regional fat / muscle
const COEF = {
  underbust: { fat: { chest: 2.0, core: 0.7 }, mus: { chest: 3.0 } },
  waist: { fat: { core: 4.5 }, mus: { core: 0.8 } },
  hips: { fat: { glutes: 2.6, legs: 0.6 }, mus: { glutes: 2.0, legs: 0.5 } },
  arm: { fat: { arms: 2.5 }, mus: { arms: 4.5 } },
  thigh: { fat: { legs: 2.2 }, mus: { legs: 2.2 } }
}
const MANA_DECAY = 0.5, MILK_KCAL_PER_ML = 0.8
const MANA_PER_KG = { mus: 8, fat: 3, gland: 150 }   // mana stored per kg of muscle, fat and glandular tissue
const CURSES = ['hunger', 'leech', 'forced', 'bias']
const BREAST_FAT_SHARE = 0.25, FAT_G_PER_CC = 0.92, CONN_CC = 20
const CUPS = ['AAA', 'AA', 'A', 'B', 'C', 'D', 'DD', 'E', 'F', 'G', 'H', 'I', 'J', 'K']
const LOOKS = ['curvy', 'athletic', 'soft', 'off']
const PARTS = { chest: 'chest', bust: 'chest', breast: 'chest', breasts: 'chest', arm: 'arms', arms: 'arms', core: 'core', waist: 'core', stomach: 'core', belly: 'core', abs: 'core', glute: 'glutes', glutes: 'glutes', hip: 'glutes', hips: 'glutes', leg: 'legs', legs: 'legs', thigh: 'legs', thighs: 'legs', body: 'all', all: 'all' }
const PART_RE = '(chest|bust|breasts?|arms?|core|waist|stomach|belly|abs|glutes?|hips?|legs?|thighs?|body|all)'

