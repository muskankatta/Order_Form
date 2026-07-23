export const SALES_REPS = [
  // ── INDIA TEAM ─────────────────────────────────────────────────────────────
  { id:'3169', name:'Abhishek Dalvi',    slack:'U0A6WDTN1K7', email:'abhishekdalvi@gofynd.com',    team:'India',  role:'Sales',           target:7000000,   targetCurrency:'INR' },
  { id:'3182', name:'Anshuman Singh',    slack:'U0AD7ENHY04', email:'anshuman@gofynd.com',          team:'India',  role:'Sales',           target:8000000,   targetCurrency:'INR' },
  { id:'1558', name:'Ashutosh Rai',      slack:'U02NN4RG6JY', email:'ashutoshrai@gofynd.com',       team:'India',  role:'Sales',           target:8500000,   targetCurrency:'INR' },
  { id:'1594', name:'Chintan Saglani',   slack:'U02SMKD8FH8', email:'chintansaglani@gofynd.com',    team:'India',  role:'-',               target:null,      targetCurrency:'INR' },
  { id:'2226', name:'Divya Kumari',      slack:'U046S3KCEMR', email:'divyakumari@gofynd.com',       team:'India',  role:'Customer Success', target:null,     targetCurrency:'INR' },
  { id:'1142', name:'Gaurav Bole',       slack:'UD51MCZT5',   email:'gauravbole@gofynd.com',        team:'India',  role:'KAM',             target:null,      targetCurrency:'INR' },
  { id:'3081', name:'Hemant Gupta',      slack:'U09D0KS8MGU', email:'hemantgupta@gofynd.com',       team:'India',  role:'Sales',           target:10000000,  targetCurrency:'INR' },
  { id:'K001', name:'Kedar Kulkarni',    slack:'U0332TP5GTY', email:'kedarkulkarni@gofynd.com',     team:'India',  role:'Product',         target:null,      targetCurrency:'INR' },
  { id:'1270', name:'Kunal Kumar',       slack:'URU3PEGN6',   email:'kunalkumar@gofynd.com',        team:'India',  role:'Sales',           target:17500000,  targetCurrency:'INR' },
  { id:'2866', name:'Manish Upadhyay',   slack:'U089C7U3DAN', email:'manishupadhyay@gofynd.com',    team:'India',  role:'Inside Sales',    target:null,      targetCurrency:'INR' },
  { id:'1477', name:'Pooja Dwivedi',     slack:'U02CHLEB3LG', email:'poojadwivedi@gofynd.com',      team:'India',  role:'Customer Success', target:null,     targetCurrency:'INR' },
  { id:'2994', name:'Praveen Sharma',    slack:'U0918EEFUKS', email:'praveensharma1@gofynd.com',    team:'India',  role:'Sales',           target:6000000,   targetCurrency:'INR' },
  { id:'2403', name:'Prem Raja',         slack:'U04J0CW9XRA', email:'premraja@gofynd.com',          team:'India',  role:'Inside Sales',    target:null,      targetCurrency:'INR' },
  { id:'2233', name:'Ragini Varma',      slack:'U4E0RBPJ6',   email:'raginivarma@gofynd.com',       team:'India',  role:'CBO',             target:null,      targetCurrency:'INR' },
  { id:'2649', name:'Rakesh Jaiswal',    slack:'U074JJV27GW', email:'rakeshjaiswal@gofynd.com',     team:'India',  role:'Sales',           target:15800000,  targetCurrency:'INR' },
  { id:'3030', name:'Shireen Ahmed',     slack:'U094CCGLYFM', email:'shireenahmed@gofynd.com',      team:'India',  role:'Sales',           target:9000000,   targetCurrency:'INR' },
  { id:'3204', name:'Shraddha Sharma',   slack:'U0B1CB95K1U', email:'shraddhas@gofynd.com',         team:'India',  role:'Sales',           target:null,      targetCurrency:'INR' },
  { id:'1953', name:'Shweta Lamba',      slack:'U03PXBAHU68', email:'shwetalamba@gofynd.com',       team:'India',  role:'Inside Sales',    target:null,      targetCurrency:'INR' },
  { id:'3089', name:'Swati Gupta',       slack:'U09EK4RG31B', email:'swatigupta1@gofynd.com',       team:'India',  role:'KAM',             target:null,      targetCurrency:'INR' },
  { id:'1989', name:'Vaibhav Puthalath', slack:'U03RT8TJY74', email:'vaibhavp@gofynd.com',          team:'India',  role:'KAM',             target:null,      targetCurrency:'INR' },
  { id:'2635', name:'Yadvendra Singh',   slack:'U072WEB2TGS', email:'yadvendrasingh@gofynd.com',    team:'India',  role:'Sales',           target:10000000,  targetCurrency:'INR' },
  { id:'1889', name:'Yugandhar Hode',    slack:'U03LWJWJXEY', email:'yugandharhode@gofynd.com',     team:'India',  role:'KAM',             target:null,      targetCurrency:'INR' },
  { id:'2927', name:'Ninad Mandavkar',   slack:'U0764AWNYKX', email:'ninadmandavkar@gofynd.com',    team:'India',  role:'Sales',           target:1000000,   targetCurrency:'INR' },
  // Moved from AI/SaaS → India
  { id:'3076', name:'Deep Jindal',       slack:'U09D0KZV2A0', email:'deepjindal@gofynd.com',        team:'India',  role:'Sales',           target:null,      targetCurrency:'INR' },
  { id:'2933', name:'Faizan Ansari',     slack:'U08N41VP4JW', email:'faizanansari@gofynd.com',      team:'India',  role:'Sales',           target:null,      targetCurrency:'INR' },
  { id:'2935', name:'Saritha Ravi',      slack:'U08N41SD8F4', email:'saritharavi@gofynd.com',       team:'India',  role:'Sales',           target:null,      targetCurrency:'INR' },
  { id:'3128', name:'Shresth Gupta',     slack:'U09R6079V9N', email:'shresthgupta@gofynd.com',      team:'India',  role:'BDR',             target:null,      targetCurrency:'INR' },
  { id:'1396', name:'Jay Karia',         slack:'U01T33X34UU', email:'jaykaria@gofynd.com',          team:'India',  role:'Product',         target:null,      targetCurrency:'INR' },

  // ── GLOBAL TEAM — MEA ──────────────────────────────────────────────────────
  { id:'S105', name:'Dharmendra Mehta',  slack:'U07KGJ8MTUK', email:'dharmendra@gofynd.com',        team:'Global', region:'MEA', role:'Sales',   target:800000,  targetCurrency:'USD' },
  { id:'1327', name:'Nayan Lathiya',     slack:'U018REY8UA2', email:'nayanlathiya@gofynd.com',      team:'Global', region:'MEA', role:'Product', target:85000,   targetCurrency:'USD' },
  { id:'S112', name:'Rushabh Mehta',     slack:'U08F74BT57E', email:'rushabhmehta1@gofynd.com',     team:'Global', region:'MEA', role:'Sales',   target:600000,  targetCurrency:'USD' },
  { id:'S111', name:'Vishesh Kumar',     slack:'UFJ0SDTLH',   email:'visheshkumar@gofynd.com',      team:'Global', region:'MEA', role:'Sales',   target:550000,  targetCurrency:'USD' },
  { id:'2271', name:'Yazdan Irani',      slack:'U048V9AHNA3', email:'yazdanirani@gofynd.com',       team:'Global', region:'MEA', role:'Sales',   target:400000,  targetCurrency:'USD' },

  // ── GLOBAL TEAM — SEA ──────────────────────────────────────────────────────
  { id:'S106', name:'Novriansyah',       slack:'U07KA2RMW0N', email:'novri@fynd.team',              team:'Global', region:'SEA', role:'Sales', target:500000,  targetCurrency:'USD' },
  { id:'2947', name:'Jatin Jindal',      slack:'U08R9EXEW7J', email:'jatinjindal@gofynd.com',       team:'Global', region:'SEA', role:'Sales', target:null,    targetCurrency:'USD' },
  { id:'3040', name:'Abhishek Mehta',    slack:'U0965195TPX', email:'abhishekmehta@gofynd.com',     team:'Global', region:'SEA', role:'Sales', target:null,    targetCurrency:'USD' },

  // ── GLOBAL TEAM — RoW ──────────────────────────────────────────────────────
  { id:'2532', name:'Evani Routray',     slack:'U05SCN10HJ4', email:'evaniroutray@gofynd.com',      team:'Global', region:'RoW', role:'Sales',    target:350000,  targetCurrency:'USD' },
  { id:'3125', name:'Harsh Kumar',       slack:'U09Q11L8E6Q', email:'harshkumar@gofynd.com',        team:'Global', region:'RoW', role:'Sales',    target:305000,  targetCurrency:'USD' },
  { id:'3010', name:'Komal Karani',      slack:'U092K3NU18S', email:'komalkarani@gofynd.com',       team:'Global', region:'RoW', role:'Designer', target:null,    targetCurrency:'USD' },
  { id:'3159', name:'Akriti Agarwal',    slack:'U0A4F8APKBJ', email:'akritiagarwal@gofynd.com',     team:'Global', region:'RoW', role:'Sales',    target:null,    targetCurrency:'USD' },

  // ── GLOBAL TEAM — UK ───────────────────────────────────────────────────────
  { id:'3059', name:'Vipul Aggarwal',    slack:'U099PMC6FNV', email:'vipulaggarwal@gofynd.com',     team:'Global', region:'UK', role:'Sales', target:350000,  targetCurrency:'USD' },
  { id:'3080', name:'Shubham Soni',      slack:'U09D0KUAG76', email:'shubhamsoni@gofynd.com',       team:'Global', region:'UK', role:'-',     target:100000,  targetCurrency:'USD' },

  // ── GLOBAL TEAM — CBO (region-wide) ────────────────────────────────────────
  { id:'1028', name:'Ronak Modi',        slack:'U0BDD4119',   email:'ronakmodi@gofynd.com',         team:'Global', region:'', role:'CBO', target:650000, targetCurrency:'USD' },
];

export const REVOPS_USERS = [
  { id:'2804', name:'Samiksha Mane',  slack:'U07PSSKJG48', email:'samikshamane@gofynd.com',  team:'India' },
  { id:'1327', name:'Nayan Lathiya',  slack:'U018REY8UA2', email:'nayanlathiya@gofynd.com',  team:'Global' },
  { id:'1392', name:'Atharva Shetye', slack:'U01T138DQAF', email:'atharvashetye@gofynd.com', team:'India' },
  { id:'2914', name:'Muskan Katta',   slack:'U08AB8PBFPC', email:'muskankatta2@gofynd.com',  universal:true },
];

export const FINANCE_USERS = [
  { id:'2914', name:'Muskan Katta',     slack:'U08AB8PBFPC', email:'muskankatta2@gofynd.com',     universal:true },
  { id:'1363', name:'Rahul Mandowara',  slack:'U01J8GPUFND', email:'rahulmandowara@gofynd.com' },
  { id:'1045', name:'Abhimanyu Mallik', slack:'U29S6QR7F',   email:'abhimanyumallik@gofynd.com' },
  { id:'1156', name:'Rasika Jadhav',    slack:'UE1UUAHLK',   email:'rasikajadhav@gofynd.com' },
  { id:'2751', name:'Somay Dugar',      slack:'U07H3FK41U0', email:'somaydugar@gofynd.com' },
  { id:'1052', name:'Viky Sangoi',      slack:'U3JUC5YNS',   email:'vikysangoi@gofynd.com' },
  { id:'1122', name:'Roshani Mohanan',  slack:'UBZ21KS66',   email:'roshanimohan@gofynd.com' },
  { id:'3009', name:'Aditi Sinha',      slack:'U092K3G6PRQ', email:'aditisinha@gofynd.com' },
  { id:'2894', name:'Sainath Gosika',      slack:'U08GGL43Y5A', email:'sainathgosika@gofynd.com' },
  { id:'1687', name:'Siddhesh',      slack:'U036P2FQHRU', email:'siddheshmayekar@gofynd.com' }
];

export const UNIVERSAL_EMAIL = 'muskankatta2@gofynd.com';
export const ALLOWED_DOMAINS = ['gofynd.com', 'fynd.team'];

// ── Region / team taxonomy (Global is bifurcated by region) ───────────────────
export const REGIONS = ['MEA', 'SEA', 'RoW', 'UK'];

/** Derive region from rep email */
export function getRepRegion(email) {
  const rep = SALES_REPS.find(r => r.email === email);
  return rep?.region || null;
}

/** Region for a form: explicit override else derived from the rep */
export function formRegion(f) {
  return f?.region || getRepRegion(f?.sales_rep_email) || null;
}

/** Filter chips used across Dashboard / Signed / Repository views */
export const TEAM_FILTERS = [
  { id:'all',   lbl:'All' },
  { id:'India', lbl:'India' },
  { id:'MEA',   lbl:'Global · MEA' },
  { id:'SEA',   lbl:'Global · SEA' },
  { id:'RoW',   lbl:'Global · RoW' },
  { id:'UK',    lbl:'Global · UK' },
  { id:'RJW',   lbl:'RJW' },
];

/** Does a form match the selected team/region filter? */
export function matchesTeamFilter(f, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'India')  return f.sales_team === 'India';
  if (filter === 'RJW')    return f.sales_team === 'RJW';
  if (filter === 'Global') return f.sales_team === 'Global';
  if (REGIONS.includes(filter)) return f.sales_team === 'Global' && formRegion(f) === filter;
  return true;
}

/** India + RJW report in INR; Global regions report in USD */
export function isUsdTeamFilter(filter) {
  return filter === 'Global' || REGIONS.includes(filter);
}

/** Resolve role from verified Google email */
export function resolveRole(email) {
  if (!email) return null;
  const domain = email.split('@')[1];
  if (!ALLOWED_DOMAINS.includes(domain)) return null;
  if (email === UNIVERSAL_EMAIL) return 'universal';
  if (FINANCE_USERS.find(u => u.email === email)) return 'finance';
  if (REVOPS_USERS.find(u => u.email === email))  return 'revops';
  const rep = SALES_REPS.find(u => u.email === email);
  if (rep?.role === 'CBO') return 'cbo';   // read-only leadership view (full visibility)
  if (rep)                 return 'sales';
  // Not in any list — auto-viewer for gofynd.com only
  return domain === 'gofynd.com' ? 'viewer' : null;
}
/** Get full user object from any list by email */
export function getUserByEmail(email) {
  return (
    FINANCE_USERS.find(u => u.email === email) ||
    REVOPS_USERS.find(u => u.email === email)  ||
    SALES_REPS.find(u => u.email === email)    ||
    null
  );
}
