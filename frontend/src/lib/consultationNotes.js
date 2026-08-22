const emptyDose = () => ({ dose: '', ga_weeks: '' });
const emptyScan = () => ({ id: '', date: '', ga_weeks: '', notes: '' });

export const emptyExam = () => ({
  lie: '',
  presentation: '',
  sfh: '',
  fetal_heart: '',
});

export const emptyVitalsEntry = () => ({
  id: '',
  date: '',
  bp_systolic: '',
  bp_diastolic: '',
  pr: '',
  weight_kg: '',
  height_cm: '',
  rr: '',
  temp_c: '',
  protein: '',
  glucose: '',
});

export const emptyConsult = () => ({
  vitals_log: [],
  drugs_vaccines: {
    medications: '',
    ipt: [emptyDose()],
    tt: [emptyDose()],
  },
  scans_log: [emptyScan()],
  examination: emptyExam(),
  important_remarks: '',
});

const asText = (v) => (v == null ? '' : String(v));

const normalizeDoseList = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return [emptyDose()];
  return arr.map((d) => ({
    dose: asText(d?.dose),
    ga_weeks: d?.ga_weeks == null ? '' : String(d.ga_weeks),
  }));
};

const normalizeVitals = (row) => ({
  ...emptyVitalsEntry(),
  id: asText(row?.id) || `v-${Math.random().toString(36).slice(2, 9)}`,
  date: asText(row?.date).slice(0, 10),
  bp_systolic: asText(row?.bp_systolic),
  bp_diastolic: asText(row?.bp_diastolic),
  pr: asText(row?.pr),
  weight_kg: asText(row?.weight_kg),
  height_cm: asText(row?.height_cm),
  rr: asText(row?.rr),
  temp_c: asText(row?.temp_c),
  protein: asText(row?.protein),
  glucose: asText(row?.glucose),
});

const normalizeScan = (row) => ({
  id: asText(row?.id) || `s-${Math.random().toString(36).slice(2, 9)}`,
  date: asText(row?.date).slice(0, 10),
  ga_weeks: row?.ga_weeks == null ? '' : String(row.ga_weeks),
  notes: asText(row?.notes),
});

export function mapPregnancyToConsult(pr) {
  const dv = pr?.drugs_vaccines && typeof pr.drugs_vaccines === 'object' ? pr.drugs_vaccines : {};
  const exam = pr?.examination && typeof pr.examination === 'object' ? pr.examination : {};
  const scans = Array.isArray(pr?.scans_log) ? pr.scans_log.map(normalizeScan) : [];
  return {
    vitals_log: Array.isArray(pr?.vitals_log) ? pr.vitals_log.map(normalizeVitals) : [],
    drugs_vaccines: {
      medications: asText(dv.medications),
      ipt: normalizeDoseList(dv.ipt),
      tt: normalizeDoseList(dv.tt),
    },
    scans_log: scans.length ? scans : [emptyScan()],
    examination: {
      lie: asText(exam.lie),
      presentation: asText(exam.presentation),
      sfh: asText(exam.sfh),
      fetal_heart: asText(exam.fetal_heart),
    },
    important_remarks: asText(pr?.important_remarks),
  };
}

export function migrateConsultDraft(raw, remarksFallback = '') {
  const base = emptyConsult();
  if (!raw || typeof raw !== 'object') {
    return { ...base, important_remarks: remarksFallback || '' };
  }
  const dv = raw.drugs_vaccines && typeof raw.drugs_vaccines === 'object' ? raw.drugs_vaccines : {};
  return {
    vitals_log: Array.isArray(raw.vitals_log) ? raw.vitals_log.map(normalizeVitals) : [],
    drugs_vaccines: {
      medications: asText(dv.medications),
      ipt: normalizeDoseList(dv.ipt),
      tt: normalizeDoseList(dv.tt),
    },
    scans_log: Array.isArray(raw.scans_log) && raw.scans_log.length
      ? raw.scans_log.map(normalizeScan)
      : [emptyScan()],
    examination: { ...emptyExam(), ...(raw.examination || {}) },
    important_remarks: asText(raw.important_remarks || remarksFallback),
  };
}

const filledDose = (d) => (d.dose && String(d.dose).trim()) || (d.ga_weeks !== '' && d.ga_weeks != null);

const filledScan = (s) =>
  (s.date && String(s.date).trim()) ||
  (s.ga_weeks !== '' && s.ga_weeks != null) ||
  (s.notes && String(s.notes).trim());

export function buildConsultPayload(consult) {
  const c = consult || emptyConsult();
  const ipt = (c.drugs_vaccines?.ipt || []).filter(filledDose).map((d) => ({
    dose: d.dose || null,
    ga_weeks: d.ga_weeks === '' || d.ga_weeks == null ? null : d.ga_weeks,
  }));
  const tt = (c.drugs_vaccines?.tt || []).filter(filledDose).map((d) => ({
    dose: d.dose || null,
    ga_weeks: d.ga_weeks === '' || d.ga_weeks == null ? null : d.ga_weeks,
  }));
  const scans = (c.scans_log || []).filter(filledScan).map((s) => ({
    id: s.id || undefined,
    date: s.date || null,
    ga_weeks: s.ga_weeks === '' || s.ga_weeks == null ? null : s.ga_weeks,
    notes: s.notes || null,
  }));
  const exam = c.examination || emptyExam();
  return {
    vitals_log: (c.vitals_log || []).map((v) => ({
      id: v.id || undefined,
      date: v.date || null,
      bp_systolic: v.bp_systolic === '' ? null : v.bp_systolic,
      bp_diastolic: v.bp_diastolic === '' ? null : v.bp_diastolic,
      pr: v.pr === '' ? null : v.pr,
      weight_kg: v.weight_kg === '' ? null : v.weight_kg,
      height_cm: v.height_cm === '' ? null : v.height_cm,
      rr: v.rr === '' ? null : v.rr,
      temp_c: v.temp_c === '' ? null : v.temp_c,
      protein: v.protein || null,
      glucose: v.glucose || null,
    })),
    drugs_vaccines: {
      medications: c.drugs_vaccines?.medications || null,
      ipt,
      tt,
    },
    scans_log: scans,
    examination: {
      lie: exam.lie || null,
      presentation: exam.presentation || null,
      sfh: exam.sfh || null,
      fetal_heart: exam.fetal_heart || null,
    },
    important_remarks: c.important_remarks || null,
  };
}

export function countFilledConsult(consult) {
  if (!consult) return 0;
  let n = (consult.vitals_log || []).length;
  if (consult.drugs_vaccines?.medications?.trim()) n += 1;
  n += (consult.drugs_vaccines?.ipt || []).filter(filledDose).length;
  n += (consult.drugs_vaccines?.tt || []).filter(filledDose).length;
  n += (consult.scans_log || []).filter(filledScan).length;
  const exam = consult.examination || {};
  n += ['lie', 'presentation', 'sfh', 'fetal_heart'].filter((k) => exam[k] && String(exam[k]).trim()).length;
  if (consult.important_remarks?.trim()) n += 1;
  return n;
}

export const newDoseRow = emptyDose;
export const newScanRow = () => ({
  ...emptyScan(),
  id: `s-${Date.now().toString(36)}`,
});
export const newVitalsId = () => `v-${Date.now().toString(36)}`;
