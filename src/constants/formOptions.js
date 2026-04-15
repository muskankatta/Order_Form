export const SERVICES = [
  'Konnect','Storefront (B2C)','Storefront (B2B)','WMS (B2C)','WMS (B2B)',
  'StoreOS','AI Photoshoot','DaaS','TMS','TMS (Logistics)','Kaily','GlamAR',
  'Boltic','GaaS','PixelBin','AI PIM','Logistics','Engage',
  'Partner (Extensions)','AI Studio',
];

export const SEGMENTS    = ['AI/SaaS','AI Commerce','Commerce'];
export const SALES_TEAMS = ['India','Global','AI/SaaS'];
export const LEAD_TYPES  = ['Direct','Indirect'];
// Direct: Event, Inside Sales/Pre-Sales | Indirect: Partner only
export const LEAD_CATS = {
  Direct:   ['Event','Inside Sales/Pre-Sales','NA'],
  Indirect: ['Partner'],
};

// Label for the lead name field based on category
export const LEAD_NAME_LABEL = {
  'Event':                  'Event name',
  'Inside Sales/Pre-Sales': "Person's name",
  'NA':                     null, // hide field
  'Partner':                'Partner name',
};
// Indirect also needs a partner name field (handled in StepClient)
export const SALE_TYPES  = ['New Business','Renewal','Upsell','Cross-Sell','Shift from SoW','Revision in Commercials'];
export const COUNTRIES   = ['India','UAE','USA','UK','Singapore','Australia','Malaysia','Indonesia','Saudi Arabia','South Africa','Other'];

export const OF_TERMS = [
  {label:'1 Month',months:1},{label:'3 Months',months:3},{label:'6 Months',months:6},
  {label:'12 Months',months:12},{label:'24 Months',months:24},{label:'36 Months',months:36},
  {label:'48 Months',months:48},{label:'60 Months',months:60},
];

export const FEE_TYPES = [
  'Setup Fee','Subscription Fee','Platform Fee','Licensing Fee','One-Time Fee',
  'Transaction Fee','Logistics Fee','Usage Fee','Add-on Fee','Resource Fee',
];

export const FEE_RULES = {
  'Setup Fee':       { locked:'One Time' },
  'One-Time Fee':    { locked:'One Time' },
  'Logistics Fee':   { locked:'Monthly'  },
  'Subscription Fee':{ opts:['Monthly','Quarterly','Bi-Annually','Annually'] },
  'Platform Fee':    { opts:['Monthly','Quarterly','Bi-Annually','Annually'] },
  'Transaction Fee': { opts:['Monthly','Quarterly','Bi-Annually','Annually'] },
  'Licensing Fee':   { opts:['Monthly','Quarterly','Bi-Annually','Annually','One Time'] },
  'Usage Fee':       { opts:['Monthly','Quarterly','Bi-Annually','Annually','One Time'] },
  'Add-on Fee':      { opts:['Monthly','Quarterly','Bi-Annually','Annually','One Time'] },
  'Resource Fee':    { opts:['Monthly','Quarterly','Bi-Annually','Annually','One Time'] },
};

export const GRADUATED_ELIGIBLE = ['Transaction Fee','Licensing Fee','Usage Fee','Add-on Fee'];
export const STEP_UP_ELIGIBLE   = ['Subscription Fee','Platform Fee','Licensing Fee'];

// Slab rate unit options for graduated pricing
export const SLAB_RATE_UNITS = [
  'per Item','per Bag','per Shipment','per Order','per SKU',
  'per Store','per Warehouse','per Rider','per User',
  'per AI Video','per Image','per Tech Pack',
  '% of BCA','% of VOG',
];

export const UNIT_METRICS = [
  '','Placed (bag)','Placed (shipment)','Placed (order)','Placed (item)',
  'Store','User','Rider','Warehouse','Location','Item','SKU','Credit',
  'Message (WhatsApp)','Image','Video','Tech Pack','Forward Picked',
  'RTO Picked','Return Picked','BCA (Brand Calculated Amount)',
  'VOG (Value of Goods)','Custom',
];

export const PAY_TRIGGERS = [
  '','100% on Execution of OF','50% on Execution / 50% on Go-Live',
  '50% Advance / 50% before Delivery','Monthly on Actuals','As per Rate Card','Custom',
];

export const PAY_TERMS      = ['Net 7','Net 15','Net 30','Net 60','Advance','Custom'];
export const RENEWAL_FREQS  = ['Monthly','Quarterly','Bi-Annually','Annually'];
export const GAAS_PAYMENT_TRIGGERS = ['Dispatch', 'Delivery', 'Invoice'];
export const GAAS_PAYMENT_NETS     = ['Net 30', 'Net 45', 'Net 60', 'Net 90'];

export const CURRENCIES = [
  {code:'INR',name:'Indian Rupee',sym:'₹'},
  {code:'USD',name:'US Dollar',sym:'$'},
  {code:'AED',name:'UAE Dirham',sym:'د.إ'},
  {code:'GBP',name:'British Pound',sym:'£'},
  {code:'EUR',name:'Euro',sym:'€'},
  {code:'MYR',name:'Malaysian Ringgit',sym:'RM'},
  {code:'IDR',name:'Indonesian Rupiah',sym:'Rp'},
  {code:'SGD',name:'Singapore Dollar',sym:'S$'},
  {code:'SAR',name:'Saudi Riyal',sym:'﷼'},
  {code:'AUD',name:'Australian Dollar',sym:'A$'},
  {code:'CAD',name:'Canadian Dollar',sym:'C$'},
  {code:'JPY',name:'Japanese Yen',sym:'¥'},
  {code:'CHF',name:'Swiss Franc',sym:'Fr'},
  {code:'NZD',name:'New Zealand Dollar',sym:'NZ$'},
  {code:'ZAR',name:'South African Rand',sym:'R'},
  {code:'BHD',name:'Bahraini Dinar',sym:'BD'},
  {code:'KWD',name:'Kuwaiti Dinar',sym:'KD'},
  {code:'QAR',name:'Qatari Riyal',sym:'QR'},
  {code:'OMR',name:'Omani Rial',sym:'RO'},
  {code:'THB',name:'Thai Baht',sym:'฿'},
  {code:'PHP',name:'Philippine Peso',sym:'₱'},
  {code:'BDT',name:'Bangladeshi Taka',sym:'৳'},
  {code:'PKR',name:'Pakistani Rupee',sym:'₨'},
  {code:'LKR',name:'Sri Lankan Rupee',sym:'Rs'},
];

export const SOW_REQUIRED_TYPES = new Set([
  'New Business','Renewal','Upsell','Cross-Sell',
  'Revision in Commercials','Shift from SoW',
]);
export const SOW_REFERENCE_TYPES = new Set(['Revision in Commercials','Shift from SoW']);

export const BLANK_FORM = {
  customer_name:'', brand_name:'', billing_address:'', gstin:'', pan:'',
  country:'India', segment:'', sales_team:'', sales_rep_name:'',
  sales_rep_email:'', slack_id:'', sale_type:'', lead_type:'',
  lead_name:'', lead_category:'', client_rep_name:'', client_rep_mobile:'',
  client_rep_email:'', billing_email:'', po_required:'No',
  start_date:'', end_date:'', of_term:'', of_term_months:12,
  auto_renewal:'Yes', renewal_term:'Annually', committed_currency:'INR',
  payment_terms:'Net 7', of_value:'', arr_text:'', committed_revenue:'',
  services_fees:[], special_terms:'', comments:'', signatory_name:'',
  signatory_designation:'', signatory_email:'', customer_cc:'',
  sow_document:null, sow_reference_document:null,
  expected_delivery_date: '',
  gaas_payment_trigger:   '',
  gaas_payment_net:       '',
};
