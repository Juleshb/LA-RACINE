import { useEffect, useMemo, useState } from 'react';

const PROVINCE_LABELS = {
  KIGALI: 'Kigali / Umujyi wa Kigali',
  SOUTH: 'Southern / Amajyepfo',
  WEST: 'Western / Iburengerazuba',
  NORTH: 'Northern / Amajyaruguru',
  EAST: 'Eastern / Iburasirazuba',
};

function Label({ children, required }) {
  return (
    <label className="label">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function LocationSelect({ label, required, value, onChange, options, disabled, loading }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <select
        className="input"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
      >
        <option value="">{loading ? 'Chargement…' : '— Sélectionner —'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function RwandaLocationSelect({ value, onChange, required = true }) {
  const [locationApi, setLocationApi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    import('@devrw/rwanda-location')
      .then((mod) => {
        if (active) {
          setLocationApi(mod.rwandaLocation);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const provinces = useMemo(() => {
    if (!locationApi) return [];
    return locationApi.getProvinces().map((p) => ({
      value: p.name,
      label: PROVINCE_LABELS[p.name] || p.name,
    }));
  }, [locationApi]);

  const provinceCode = useMemo(() => {
    if (!locationApi || !value.province) return null;
    return locationApi.getProvinces().find((p) => p.name === value.province)?.code ?? null;
  }, [locationApi, value.province]);

  const districts = useMemo(() => {
    if (!locationApi || !provinceCode) return [];
    return locationApi.getDistricts(provinceCode).map((d) => ({
      value: d.name,
      label: d.name,
    }));
  }, [locationApi, provinceCode]);

  const districtCode = useMemo(() => {
    if (!locationApi || !provinceCode || !value.district) return null;
    return locationApi.getDistricts(provinceCode).find((d) => d.name === value.district)?.code ?? null;
  }, [locationApi, provinceCode, value.district]);

  const sectors = useMemo(() => {
    if (!locationApi || !districtCode) return [];
    return locationApi.getSectors(districtCode).map((s) => ({
      value: s.name,
      label: s.name,
    }));
  }, [locationApi, districtCode]);

  const sectorCode = useMemo(() => {
    if (!locationApi || !districtCode || !value.sector) return null;
    return locationApi.getSectors(districtCode).find((s) => s.name === value.sector)?.code ?? null;
  }, [locationApi, districtCode, value.sector]);

  const cells = useMemo(() => {
    if (!locationApi || !sectorCode) return [];
    return locationApi.getCells(sectorCode).map((c) => ({
      value: c.name,
      label: c.name,
    }));
  }, [locationApi, sectorCode]);

  const cellCode = useMemo(() => {
    if (!locationApi || !sectorCode || !value.cell) return null;
    return locationApi.getCells(sectorCode).find((c) => c.name === value.cell)?.code ?? null;
  }, [locationApi, sectorCode, value.cell]);

  const villages = useMemo(() => {
    if (!locationApi || !cellCode) return [];
    return locationApi.getVillages(cellCode).map((v) => ({
      value: v.name,
      label: v.name,
    }));
  }, [locationApi, cellCode]);

  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LocationSelect
        label="Province / Intara"
        required={required}
        value={value.province || ''}
        onChange={(province) => update({ province, district: '', sector: '', cell: '', village: '' })}
        options={provinces}
        loading={loading}
      />
      <LocationSelect
        label="District / Akarere"
        required={required}
        value={value.district || ''}
        onChange={(district) => update({ district, sector: '', cell: '', village: '' })}
        options={districts}
        disabled={!value.province}
        loading={loading}
      />
      <LocationSelect
        label="Secteur / Umurenge"
        required={required}
        value={value.sector || ''}
        onChange={(sector) => update({ sector, cell: '', village: '' })}
        options={sectors}
        disabled={!value.district}
        loading={loading}
      />
      <LocationSelect
        label="Cellule / Akagari"
        required={required}
        value={value.cell || ''}
        onChange={(cell) => update({ cell, village: '' })}
        options={cells}
        disabled={!value.sector}
        loading={loading}
      />
      <LocationSelect
        label="Village / Umudugudu"
        required={required}
        value={value.village || ''}
        onChange={(village) => update({ village })}
        options={villages}
        disabled={!value.cell}
        loading={loading}
      />
    </div>
  );
}
