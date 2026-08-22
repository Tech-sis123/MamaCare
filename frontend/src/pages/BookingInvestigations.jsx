import { GENOTYPE_CHIPS, splitAboRh } from '../lib/investigations';

const chipCls = (active) =>
  `px-3 py-1.5 rounded-lg text-xs font-label-sm border transition-colors ${
    active
      ? 'bg-primary text-white border-primary'
      : 'bg-surface-container-low text-on-surface border-outline/20 hover:border-primary/40'
  }`;

const inputCls =
  'bg-surface-container-low text-sm px-3 py-2 rounded-lg w-full text-on-surface border border-outline/20 focus:border-primary outline-none';

const InvField = ({ label, children }) => (
  <div className="py-3 border-b border-outline-variant/25 last:border-b-0">
    <p className="font-label-sm text-on-surface text-sm font-medium mb-2">{label}</p>
    {children}
  </div>
);

const ChipGroup = ({ options, value, onChange, ariaLabel }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
    {options.map((opt) => {
      const val = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      const active = String(value || '') === String(val);
      return (
        <button
          key={val}
          type="button"
          className={chipCls(active)}
          aria-pressed={active}
          onClick={() => onChange(active ? '' : val)}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const ABO = ['O', 'A', 'B', 'AB'];
const RH = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
];
const GRADE_NONE = ['+', '++', '+++', 'None'];
const GRADE_NONE_LOWER = ['+', '++', '+++', 'none'];
const POS_NEG = ['Positive', 'Negative'];
const GENOTYPE_OPTS = [...GENOTYPE_CHIPS, { value: 'others', label: 'others' }];
const REQUEST_OPTS = [
  { value: 'Routine investigations', label: 'Routine investigations' },
  { value: 'others', label: 'others' },
];

const BookingInvestigations = ({
  patientName,
  booking,
  setBook,
  investigations,
  setInvestigations,
  saveMsg,
  saving,
  onBack,
  onSave,
}) => {
  const { blood_group: abo, rhesus: rh } = splitAboRh(booking.blood_group, booking.rhesus);
  const gtRaw = String(booking.genotype || '').trim();
  const gtKnown = GENOTYPE_CHIPS.includes(gtRaw.toUpperCase());
  const gtChip = gtKnown ? gtRaw.toUpperCase() : gtRaw ? 'others' : '';
  const otherValue = investigations.genotype_other || (gtKnown ? '' : gtRaw);

  const setInv = (field, value) =>
    setInvestigations((prev) => ({ ...prev, [field]: value }));

  const setAdditional = (index, field, value) => {
    setInvestigations((prev) => {
      const additional = [...(prev.additional || [])];
      additional[index] = { ...(additional[index] || { test: '', result: '' }), [field]: value };
      return { ...prev, additional };
    });
  };

  const addInvestigationRow = () => {
    setInvestigations((prev) => ({
      ...prev,
      additional: [...(prev.additional || []), { test: '', result: '' }],
    }));
  };

  const removeInvestigationRow = (index) => {
    setInvestigations((prev) => {
      const additional = [...(prev.additional || [])];
      additional.splice(index, 1);
      return {
        ...prev,
        additional: additional.length ? additional : [{ test: '', result: '' }],
      };
    });
  };

  const onGenotypeChip = (val) => {
    if (!val) {
      setBook('genotype', '');
      setInv('genotype_other', '');
      return;
    }
    if (val === 'others') {
      setBook('genotype', otherValue || 'others');
      if (!investigations.genotype_other && !gtKnown) {
        setInv('genotype_other', gtRaw && gtRaw !== 'others' ? gtRaw : '');
      }
      return;
    }
    setBook('genotype', val);
    setInv('genotype_other', '');
  };

  const statusIsError =
    saveMsg &&
    !/saved/i.test(saveMsg) &&
    !/^Saved$/i.test(saveMsg);
  const statusIsOffline = saveMsg && /locally|offline|sync when/i.test(saveMsg);

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
      <div className="grain-overlay pointer-events-none" />

      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-outline-variant/40">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-3 flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
            aria-label="Back to patient chart"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline-lg text-lg text-on-surface leading-tight">
              Booking Investigations
            </h1>
            {patientName ? (
              <p className="font-body-md text-xs text-on-surface-variant truncate mt-0.5">
                {patientName}
              </p>
            ) : null}
            {saveMsg ? (
              <p
                className={`font-label-sm text-[11px] mt-1 flex items-center gap-1 ${
                  statusIsError || statusIsOffline ? 'text-secondary' : 'text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {statusIsOffline ? 'cloud_off' : 'cloud_done'}
                </span>
                {saveMsg}
              </p>
            ) : (
              <p className="font-label-sm text-[11px] text-on-surface-variant mt-1">
                Progress saves automatically — drafts are kept if the network drops.
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-32">
        <section className="bg-white border border-outline-variant/40 rounded-xl shadow-sm px-4 sm:px-5">
          <div className="pt-4 pb-1">
            <h2 className="font-label-sm text-on-surface-variant uppercase tracking-widest text-xs">
              Results
            </h2>
          </div>

          <InvField label="Blood group">
            <ChipGroup
              options={ABO}
              value={abo}
              onChange={(v) => setBook('blood_group', v)}
              ariaLabel="Blood group"
            />
          </InvField>

          <InvField label="Rhesus">
            <ChipGroup
              options={RH}
              value={rh}
              onChange={(v) => setBook('rhesus', v)}
              ariaLabel="Rhesus"
            />
          </InvField>

          <InvField label="Genotype">
            <ChipGroup
              options={GENOTYPE_OPTS}
              value={gtChip}
              onChange={onGenotypeChip}
              ariaLabel="Genotype"
            />
            {gtChip === 'others' ? (
              <input
                className={`${inputCls} mt-2`}
                value={otherValue === 'others' ? '' : otherValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setInv('genotype_other', v);
                  setBook('genotype', v || 'others');
                }}
                placeholder="Specify genotype"
              />
            ) : null}
          </InvField>

          <InvField label="PCV">
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              value={investigations.pcv}
              onChange={(e) => setInv('pcv', e.target.value)}
              placeholder="Enter value"
              aria-label="PCV"
            />
          </InvField>

          <InvField label="Malaria parasite">
            <ChipGroup
              options={GRADE_NONE}
              value={investigations.malaria_parasite}
              onChange={(v) => setInv('malaria_parasite', v)}
              ariaLabel="Malaria parasite"
            />
          </InvField>

          <InvField label="VDRL">
            <ChipGroup
              options={POS_NEG}
              value={investigations.vdrl}
              onChange={(v) => setInv('vdrl', v)}
              ariaLabel="VDRL"
            />
          </InvField>

          <InvField label="HIV">
            <ChipGroup
              options={POS_NEG}
              value={investigations.hiv}
              onChange={(v) => setInv('hiv', v)}
              ariaLabel="HIV"
            />
          </InvField>

          <InvField label="HCV">
            <ChipGroup
              options={POS_NEG}
              value={investigations.hcv}
              onChange={(v) => setInv('hcv', v)}
              ariaLabel="HCV"
            />
          </InvField>

          <InvField label="HBV">
            <ChipGroup
              options={POS_NEG}
              value={investigations.hbv}
              onChange={(v) => setInv('hbv', v)}
              ariaLabel="HBV"
            />
          </InvField>

          <div className="py-3 border-b border-outline-variant/25">
            <p className="font-label-sm text-on-surface text-sm font-medium mb-3">Urinalysis</p>
            <div className="space-y-3 pl-0 sm:pl-2">
              <div>
                <p className="font-label-sm text-on-surface-variant text-xs uppercase mb-1.5">
                  Protein
                </p>
                <ChipGroup
                  options={GRADE_NONE_LOWER}
                  value={investigations.protein}
                  onChange={(v) => setInv('protein', v)}
                  ariaLabel="Urine protein"
                />
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant text-xs uppercase mb-1.5">
                  Glucose
                </p>
                <ChipGroup
                  options={GRADE_NONE_LOWER}
                  value={investigations.glucose}
                  onChange={(v) => setInv('glucose', v)}
                  ariaLabel="Urine glucose"
                />
              </div>
            </div>
          </div>

          <InvField label="RBG">
            <input
              className={inputCls}
              value={investigations.rbg}
              onChange={(e) => setInv('rbg', e.target.value)}
              placeholder="Enter value"
              aria-label="RBG"
            />
          </InvField>

          <InvField label="OGTT">
            <input
              className={inputCls}
              value={investigations.ogtt}
              onChange={(e) => setInv('ogtt', e.target.value)}
              placeholder=""
              aria-label="OGTT"
            />
          </InvField>

          <div className="py-3 border-b border-outline-variant/25">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-label-sm text-on-surface text-sm font-medium">Add investigation</p>
              <button
                type="button"
                onClick={addInvestigationRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-label-sm text-primary hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add another
              </button>
            </div>
            <div className="space-y-3">
              {(investigations.additional || []).map((row, i) => (
                <div
                  key={`add-inv-${i}`}
                  className="rounded-lg border border-outline-variant/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-label-sm text-on-surface-variant text-xs uppercase">
                      Test done
                    </p>
                    {(investigations.additional || []).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeInvestigationRow(i)}
                        className="text-on-surface-variant hover:text-secondary"
                        aria-label="Remove investigation"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    ) : null}
                  </div>
                  <input
                    className={inputCls}
                    value={row.test || ''}
                    onChange={(e) => setAdditional(i, 'test', e.target.value)}
                    placeholder=""
                    aria-label={`Test done ${i + 1}`}
                  />
                  <p className="font-label-sm text-on-surface-variant text-xs uppercase">Result</p>
                  <input
                    className={inputCls}
                    value={row.result || ''}
                    onChange={(e) => setAdditional(i, 'result', e.target.value)}
                    placeholder=""
                    aria-label={`Result ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <InvField label="Request investigation">
            <ChipGroup
              options={REQUEST_OPTS}
              value={investigations.request_investigation}
              onChange={(v) => {
                setInvestigations((prev) => ({
                  ...prev,
                  request_investigation: v,
                  request_other: v === 'others' ? prev.request_other : '',
                }));
              }}
              ariaLabel="Request investigation"
            />
            {investigations.request_investigation === 'Routine investigations' ? (
              <p className="font-body-md text-xs text-on-surface-variant mt-2">
                Routine panel: PCV, HIV, Hep B &amp; C, blood group, genotype.
              </p>
            ) : null}
            {investigations.request_investigation === 'others' ? (
              <input
                className={`${inputCls} mt-2`}
                value={investigations.request_other}
                onChange={(e) => setInv('request_other', e.target.value)}
                placeholder="Specify investigation"
                aria-label="Other investigation request"
              />
            ) : null}
          </InvField>
        </section>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-outline-variant z-40">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onBack}
            className="bg-surface-container-high text-on-surface py-3.5 rounded-lg font-label-sm text-sm border border-outline/20"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-primary text-white py-3.5 rounded-lg font-label-sm text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default BookingInvestigations;
