const KNOWN_GENOTYPES = ['AA', 'AS', 'SS', 'AC'];

const POS_NEG = {
  positive: 'Positive',
  pos: 'Positive',
  '+': 'Positive',
  reactive: 'Positive',
  detected: 'Positive',
  negative: 'Negative',
  neg: 'Negative',
  '-': 'Negative',
  'non-reactive': 'Negative',
  nonreactive: 'Negative',
  nr: 'Negative',
  'not detected': 'Negative',
};

export const emptyInvestigations = () => ({
  hiv: '',
  vdrl: '',
  pcv: '',
  hbv: '',
  hcv: '',
  malaria_parasite: '',
  protein: '',
  glucose: '',
  urinalysis: '',
  rbg: '',
  ogtt: '',
  additional: [{ test: '', result: '' }],
  request_investigation: '',
  request_other: '',
  genotype_other: '',
});

export function normalizePosNeg(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  return POS_NEG[s.toLowerCase()] || s;
}

export function normalizeMp(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (['+', '++', '+++'].includes(s)) return s;
  if (/^(none|nil|neg|negative|n\/a)$/i.test(s)) return 'None';
  return s;
}

export function normalizeGrade(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (['+', '++', '+++'].includes(s)) return s;
  if (/^(none|nil|neg|negative|n\/a)$/i.test(s)) return 'none';
  return s;
}

/** Split combined values like "O+" into ABO + rhesus. */
export function splitAboRh(group, rhesus) {
  const g = String(group || '').trim();
  const m = g.match(/^(AB|A|B|O)\s*([+-]|positive|negative)?$/i);
  const asSign = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^-|^neg/i.test(s)) return '-';
    if (/^\+|^pos/i.test(s)) return '+';
    return s;
  };
  if (m) {
    return {
      blood_group: m[1].toUpperCase(),
      rhesus: m[2] ? asSign(m[2]) : asSign(rhesus),
    };
  }
  return { blood_group: g, rhesus: asSign(rhesus) };
}

export function formatBloodType(group, rhesus) {
  const { blood_group, rhesus: rh } = splitAboRh(group, rhesus);
  if (!blood_group && !rh) return '';
  if (!blood_group) return rh;
  if (/[+-]$/.test(blood_group)) return blood_group;
  if (!rh) return blood_group;
  return `${blood_group}${rh}`;
}

function extraLabsObject(pr) {
  let xl = pr?.extra_labs;
  if (typeof xl === 'string') {
    try {
      xl = JSON.parse(xl);
    } catch {
      return {};
    }
  }
  if (xl && typeof xl === 'object' && !Array.isArray(xl)) return xl;
  return {};
}

function additionalFromExtra(xl) {
  let additional = Array.isArray(xl.additional)
    ? xl.additional.map((a) => ({ test: a?.test || '', result: a?.result || '' }))
    : [];
  if (!additional.length && (xl.additional_test || xl.additional_result)) {
    additional = [{ test: xl.additional_test || '', result: xl.additional_result || '' }];
  }
  if (!additional.length) additional = [{ test: '', result: '' }];
  return additional;
}

function parseUrinalysis(xl, urinalysis) {
  let protein = xl.protein || '';
  let glucose = xl.glucose || '';
  if (!protein && !glucose && urinalysis) {
    const p = String(urinalysis).match(/protein\s*[:=]\s*([^;]+)/i);
    const g = String(urinalysis).match(/glucose\s*[:=]\s*([^;]+)/i);
    if (p) protein = p[1].trim();
    if (g) glucose = g[1].trim();
  }
  return { protein: normalizeGrade(protein), glucose: normalizeGrade(glucose) };
}

export function migrateInvestigationsDraft(inv) {
  if (!inv || typeof inv !== 'object') return emptyInvestigations();
  const next = { ...emptyInvestigations(), ...inv };
  if (!next.hiv && inv.rvd_status) next.hiv = normalizePosNeg(inv.rvd_status);
  if (!next.hbv && inv.hep_b) next.hbv = normalizePosNeg(inv.hep_b);
  if (!next.hcv && inv.hep_c) next.hcv = normalizePosNeg(inv.hep_c);
  if (next.malaria_parasite) next.malaria_parasite = normalizeMp(next.malaria_parasite);
  if (next.vdrl) next.vdrl = normalizePosNeg(next.vdrl);
  if (next.hiv) next.hiv = normalizePosNeg(next.hiv);
  if (next.hbv) next.hbv = normalizePosNeg(next.hbv);
  if (next.hcv) next.hcv = normalizePosNeg(next.hcv);
  if (!Array.isArray(next.additional) || next.additional.length === 0) {
    next.additional = [{ test: '', result: '' }];
  } else {
    next.additional = next.additional.map((a) => ({
      test: a?.test || '',
      result: a?.result || '',
    }));
  }
  return next;
}

export function mapPregnancyToInvestigations(pr) {
  const xl = extraLabsObject(pr);
  const { protein, glucose } = parseUrinalysis(xl, pr.urinalysis);
  let request = xl.request_investigation || '';
  let request_other = '';
  if (request && !/^routine/i.test(request)) {
    request_other = request;
    request = 'others';
  } else if (/^routine/i.test(request)) {
    request = 'Routine investigations';
  }

  const gt = String(pr.genotype || '').trim();
  const genotype_other = gt && !KNOWN_GENOTYPES.includes(gt.toUpperCase()) ? gt : '';

  return {
    ...emptyInvestigations(),
    hiv: normalizePosNeg(pr.rvd_status),
    vdrl: normalizePosNeg(pr.vdrl),
    pcv: pr.pcv != null && pr.pcv !== '' ? String(pr.pcv) : '',
    hbv: normalizePosNeg(pr.hep_b),
    hcv: normalizePosNeg(pr.hep_c),
    malaria_parasite: normalizeMp(pr.malaria_parasite),
    protein,
    glucose,
    urinalysis: pr.urinalysis || '',
    rbg: pr.rbg || '',
    ogtt: pr.ogtt || '',
    additional: additionalFromExtra(xl),
    request_investigation: request,
    request_other,
    genotype_other,
  };
}

export function buildInvestigationsPayload(inv, booking) {
  const pcvNum = inv.pcv !== '' && inv.pcv != null ? Number(inv.pcv) : undefined;
  const { blood_group, rhesus } = splitAboRh(booking?.blood_group, booking?.rhesus);

  const gt = String(booking?.genotype || '').trim();
  const genotype = KNOWN_GENOTYPES.includes(gt.toUpperCase())
    ? gt.toUpperCase()
    : inv.genotype_other?.trim() || gt || null;

  const additional = (inv.additional || [])
    .map((a) => ({ test: (a.test || '').trim(), result: (a.result || '').trim() }))
    .filter((a) => a.test || a.result);

  const request =
    inv.request_investigation === 'others'
      ? inv.request_other?.trim() || 'others'
      : inv.request_investigation || null;

  const protein = inv.protein || null;
  const glucose = inv.glucose || null;
  const uaParts = [];
  if (protein) uaParts.push(`protein: ${protein}`);
  if (glucose) uaParts.push(`glucose: ${glucose}`);

  return {
    blood_group: blood_group || null,
    rhesus: rhesus || null,
    genotype: genotype || null,
    pcv: pcvNum != null && !Number.isNaN(pcvNum) ? pcvNum : null,
    malaria_parasite: inv.malaria_parasite || null,
    vdrl: inv.vdrl || null,
    rvd_status: inv.hiv || null,
    hep_c: inv.hcv || null,
    hep_b: inv.hbv || null,
    rbg: inv.rbg || null,
    ogtt: inv.ogtt || null,
    urinalysis: uaParts.length ? uaParts.join('; ') : inv.urinalysis || null,
    extra_labs: {
      protein,
      glucose,
      additional,
      additional_test: additional[0]?.test || null,
      additional_result: additional[0]?.result || null,
      request_investigation: request,
    },
  };
}

export function countFilledInvestigations(inv, booking) {
  const { blood_group, rhesus } = splitAboRh(booking?.blood_group, booking?.rhesus);
  const vals = [
    blood_group,
    rhesus,
    booking?.genotype,
    inv?.pcv,
    inv?.malaria_parasite,
    inv?.vdrl,
    inv?.hiv,
    inv?.hcv,
    inv?.hbv,
    inv?.protein,
    inv?.glucose,
    inv?.rbg,
    inv?.ogtt,
    inv?.request_investigation,
  ];
  let n = vals.filter((v) => v != null && String(v).trim() !== '').length;
  n += (inv?.additional || []).filter(
    (a) => (a.test && String(a.test).trim()) || (a.result && String(a.result).trim())
  ).length;
  return n;
}

export const GENOTYPE_CHIPS = KNOWN_GENOTYPES;
