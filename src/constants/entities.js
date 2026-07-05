// ════════════════════════════════════════════════════════════════════════════
// Central entity registry — the single source of truth for every entity-specific
// value (letterhead, T&C, signatory, OF series, tax model, defaults). All files
// (StepClient, useFormWizard, FormDetail, FormsContext, StepTermsSignatory, pdf)
// read from here. Adding a future entity = one entry below.
// ════════════════════════════════════════════════════════════════════════════

// ── Default "Important Notes" (T&C) — plain text; used by the Finance-editable
//    Notes step. The PDF renders these (or the Finance-edited override).
const FYND_DEFAULT_NOTES =
`1. Entire Agreement — This Order Form, along with its accompanying schedules, annexures, Standard Operating Procedures (SOPs), Terms of Service (TOS), and Privacy Policy, if any, collectively constitute the entire agreement between the Parties (hereinafter "Agreement"). It supersedes and replaces all prior negotiations, discussions, understandings, writings, and agreements related to the subject matter herein.

2. Term — The term of this Order Form (hereinafter referred to as the "Order Form Term") includes the initial Service Period and all subsequent Renewal Terms (if applicable). The Order Form becomes effective on the commencement date of the Service Period and shall continue until the end of the Order Form Term. Renewal shall be subject to the then-current list price prevailing at the time of renewal.

3. Extension Fees — If the Client avails any of the Extension Service(s), they shall be charged an Extension Fee for that Service(s) over and above the Fees mentioned above in the Order Form.

4. Fees and Payment Terms —
a. The Client agrees to pay the fees outlined in this Order Form upon its execution and subsequently according to the Billing Frequency specified herein.
b. All fees are exclusive of applicable taxes, which will be charged separately as per prevailing laws.
c. Except for one-time fees, all recurring fees will be subject to a minimum increment of 8% on the then-current list price, as notified by Fynd at the time of renewal.
d. In the event that the Client terminates this Order Form before the expiration of the Initial Term or any then-current Renewal Term—except where such termination is due to Fynd's uncured material breach as defined in the Terms of Service—the Client shall remain liable to pay the remaining fees due for the rest of the respective term, upon termination.

5. Publicity Rights — By signing this Order Form, the Client grants Fynd the right, for the Term of this Order Form and thereafter, to use the Client's name, logo, trademark(s), and other brand identifiers for the purposes of publicity, public relations (PR), marketing, promotional, or branding activities, or otherwise disclosing its association with the Client, in any medium or format.

6. Validity — This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.`;

const YAVI_DEFAULT_NOTES =
`1. Ownership & Licensing — Shopsense Retail Technologies Limited ("Fynd") is the owner and licensor of the Software/Platform availed as Service(s) by the Client under this Order Form. Fynd has granted Yavi Technologies with licence to resell the Service(s) in the capacity of an exclusive authorized reseller by way of an independent licence agreement.

2. Agreement Scope — This Order Form shall be read together with schedules, annexures, SOP(s), SoW(s), and/or any written documents executed between the Parties, read along with the online terms and policy documents of Fynd with respect to the Service(s) being availed by the Client and shall constitute the entire understanding and agreement between the parties and replaces all prior understandings, negotiations, discussions, writings and agreements with respect to the subject matter hereof.

3. Term — The Service Period and all applicable Renewal Tenures are collectively referred to herein as the "Order Form Term". This Order Form is effective on the date the Service Period commences until the end of the Order Form Term. Renewal will be applicable on then-current list price.

4. Fees — Client will be charged the fees set forth in this Order Form upon its execution and in accordance with the applicable Billing Frequency (as defined above) thereafter. All fees (commercial value) that Client is charged, including the fees set forth in this Order Form, will be exclusive of taxes. If Client terminates this Order Form prior to the expiration of the Initial Term or then-current Renewal Term (except to the extent such termination is due to Fynd's failure to cure a material breach in accordance with the Agreement (as defined in TOS)), then Client is responsible for paying the fees set forth in this Order Form for the remaining portion of the Initial Term or then-current Renewal Term upon termination. All fees except one time fee will be applicable for a minimal increment of 8% on then-current list price (shared by Fynd to Client) upon Renewal Term.

5. Validity — This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.`;

const FYNDUK_DEFAULT_NOTES =
`1. Ownership & Licensing — Shopsense Retail Technologies Limited ("Fynd") is the owner of the Software/Platform. Shopsense Retail Technologies (UK) Limited ("Company", "we," or "us") is the contracting party under this Order Form and has been granted a licence by Fynd to market, distribute, and grant access the Service(s) in the United Kingdom pursuant to a separate intra-group licence/reseller agreement between Fynd and the Company. The Company provides the Service(s) to the Client under this Order Form on that basis.

2. Agreement Scope — This Order Form shall be read together with schedules, annexures, SOP(s), SoW(s), and/or any written documents executed between the Parties, read along with the online terms and policy documents of the Company with respect to the Service(s) being availed by the Client, and shall constitute the entire understanding and agreement between the Parties and replaces all prior understandings, negotiations, discussions, writings and agreements with respect to the subject matter hereof.

3. Term — The Service Period and all applicable Renewal Tenures are collectively referred to herein as the "Order Form Term". This Order Form is effective on the date the Service Period commences until the end of the Order Form Term. Renewal will be applicable on then-current list price.

4. Fees — Client will be charged fees as set forth in this Order Form upon its execution and in accordance with the applicable Billing Frequency (as defined above) thereafter. All fees (commercial value) that Client is charged, including the fees set forth in this Order Form, will be quoted in Pounds Sterling (GBP) and are exclusive of any other applicable taxes, duties, or levies. If Client terminates this Order Form prior to the expiration of the Initial Term or then-current Renewal Term (except to the extent such termination is due to Company's failure to cure a material breach in accordance with the Agreement (as defined in the Terms of Service)), then Client is responsible for paying the fees set forth in this Order Form for the remaining portion of the Initial Term or then-current Renewal Term upon termination. All fees except one-time fees will be applicable for a minimum increment of 8% on then-current list price (as shared by the Company to Client) upon Renewal Term.

5. Governing Law & Jurisdiction — This Order Form, and any dispute or claim arising out of or in connection with it or its subject matter (including non-contractual disputes or claims), shall be governed by and construed in accordance with the laws of England and Wales. The Parties irrevocably agree that the courts of England and Wales shall have exclusive jurisdiction to settle any such dispute or claim.

6. Validity — This Order Form shall remain valid for a period of seven (7) working days (as observed in England and Wales) from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by the Company.`;

export const ENTITIES = {
  fynd: {
    key: 'fynd',
    label: 'Shopsense Retail Technologies Limited (Fynd)',
    short: 'Fynd',
    legalName: 'Shopsense Retail Technologies Limited',
    ofPrefix: 'OF-FY-',
    // OF-number prefixes that identify this entity on historical/new records
    ofMatchers: ['OFFY', 'OF-FY'],
    defaultCurrency: 'INR',
    defaultTeam: null,
    defaultRegion: null,
    taxModel: 'india',                 // GSTIN + PAN (client), single tax for intl clients
    docx: true,
    selectorHint: 'Shopsense Retail Technologies Ltd. · Mumbai',
    ofSeriesHint: 'OF series: OF-FY-XXXX',
    chip: { bg: 'bg-teal-50 border border-teal-200', text: 'text-teal-700', codeText: 'text-teal-500', code: 'FYND' },
    signatory: {
      name: 'Sreeraman Mohan Girija',
      designation: 'Whole-time Director',
      email: 'legal@gofynd.com',
      displayEmail: true,
      forLabel: 'For: Shopsense Retail Technologies Limited',
    },
    signatoryPanel: { label: 'Fynd signatory (pre-filled)', labelColor: 'text-green-800', bgColor: 'bg-green-50 border border-green-200' },
    salesRepLabel: 'Sales Rep (Fynd)',
    footerEntity: 'Shopsense Retail Technologies Limited',
    defaultNotes: FYND_DEFAULT_NOTES,
  },

  yavi: {
    key: 'yavi',
    label: 'Yavi Technologies FZCO',
    short: 'Yavi',
    legalName: 'Yavi Technologies FZCO',
    ofPrefix: 'OF-YT-',
    ofMatchers: ['OFYT', 'OF-YT'],
    defaultCurrency: 'USD',
    defaultTeam: 'Global',
    defaultRegion: null,
    taxModel: 'vat',                   // single tax_number (VAT / TRN), required
    taxLabel: 'Tax / VAT / TRN Number',
    taxHint: 'VAT / TRN number for Yavi Technologies FZCO client',
    taxPlaceholder: 'e.g. 104789269800003',
    docx: true,
    selectorHint: 'Yavi Technologies FZCO · Dubai CommerCity',
    ofSeriesHint: 'OF series: OF-YT-XXXX',
    chip: { bg: 'bg-indigo-50 border border-indigo-200', text: 'text-indigo-700', codeText: 'text-indigo-500', code: 'YAVI' },
    signatory: {
      name: 'Vishesh Kumar',
      designation: 'Founding Director',
      email: 'accounts@yavitechnologies.com',
      displayEmail: true,
      forLabel: 'For: Yavi Technologies FZCO',
    },
    signatoryPanel: { label: 'Yavi Technologies FZCO signatory (pre-filled)', labelColor: 'text-indigo-800', bgColor: 'bg-indigo-50 border border-indigo-200' },
    salesRepLabel: 'Sales Rep (Yavi Technologies)',
    footerEntity: 'Yavi Technologies FZCO',
    defaultNotes: YAVI_DEFAULT_NOTES,
  },

  fynduk: {
    key: 'fynduk',
    label: 'Shopsense Retail Technologies (UK) Limited',
    short: 'Fynd UK',
    legalName: 'Shopsense Retail Technologies (UK) Limited',
    ofPrefix: 'OF-UK-',
    ofMatchers: ['OFUK', 'OF-UK'],
    defaultCurrency: 'GBP',
    defaultTeam: 'Global',
    defaultRegion: 'UK',
    taxModel: 'vat',                   // single tax_number (VAT), required
    taxLabel: 'VAT Registration Number',
    taxHint: 'Client VAT registration number (UK OF)',
    taxPlaceholder: 'e.g. GB123456789',
    docx: false,                       // PDF only
    selectorHint: 'Shopsense Retail Technologies (UK) Limited · London',
    ofSeriesHint: 'OF series: OF-UK-XXXX',
    chip: { bg: 'bg-blue-50 border border-blue-200', text: 'text-blue-700', codeText: 'text-blue-500', code: 'FYND UK' },
    // Letterhead: Fynd logo (left) + this text block (right)
    header: {
      name: 'Shopsense Retail Technologies (UK) Limited',
      lines: [
        'Company No. 1704410',
        '10 John Street, London WC1N 2EB',
        'Email: compliance@gofynd.com | VRN: 517184686',
      ],
    },
    signatory: {
      name: 'Sreeraman Mohan Girija',
      designation: 'Director',
      email: 'legal@gofynd.com',
      displayEmail: false,             // do not display on PDF / signatory panel
      forLabel: 'For: Shopsense Retail Technologies (UK) Limited',
    },
    signatoryPanel: { label: 'Shopsense Retail Technologies (UK) Limited signatory (pre-filled)', labelColor: 'text-blue-800', bgColor: 'bg-blue-50 border border-blue-200' },
    salesRepLabel: 'Sales Rep (Fynd UK)',
    footerEntity: 'Shopsense Retail Technologies (UK) Limited',
    defaultNotes: FYNDUK_DEFAULT_NOTES,
  },
};

export const DEFAULT_ENTITY_KEY = 'fynd';

// Dropdown options (order preserved)
export const ENTITY_OPTIONS = Object.values(ENTITIES).map(e => ({ value: e.key, label: e.label }));

/** Get an entity config by key, falling back to Fynd. */
export function getEntity(key) {
  return ENTITIES[key] || ENTITIES[DEFAULT_ENTITY_KEY];
}

/** Infer the entity key from an OF number's prefix (null if none match). */
export function entityFromOfNumber(ofNumber) {
  const n = (ofNumber || '').trim();
  if (!n) return null;
  for (const e of Object.values(ENTITIES)) {
    if ((e.ofMatchers || []).some(p => n.startsWith(p))) return e.key;
  }
  return null;
}

/** Resolve a form's entity key: explicit field first, else inferred from OF number, else Fynd. */
export function entityKeyOf(form) {
  if (form?.entity && ENTITIES[form.entity]) return form.entity;
  return entityFromOfNumber(form?.of_number) || DEFAULT_ENTITY_KEY;
}

/** Convenience: full config for a form. */
export function entityOf(form) {
  return getEntity(entityKeyOf(form));
}

/** Is this a VAT-model entity (single tax_number field), i.e. Yavi or Fynd UK? */
export function isVatEntity(key) {
  return getEntity(key).taxModel === 'vat';
}
