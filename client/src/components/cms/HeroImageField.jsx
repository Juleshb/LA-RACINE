async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * CMS control: hello / page-hero photo (URL or upload).
 */
export default function HeroImageField({ value, onChange, label = 'Hello section photo' }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
      <div>
        <label className="label mb-0">{label}</label>
        <p className="text-xs text-gray-500 mt-1">
          Shown at the top of this public page next to the title. Paste a URL or upload an image.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="input flex-1"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
        />
        <label className="btn-secondary text-sm cursor-pointer inline-flex items-center justify-center shrink-0">
          Upload photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await fileToDataUrl(file);
              onChange(url);
              e.target.value = '';
            }}
          />
        </label>
        {value ? (
          <button
            type="button"
            className="btn-secondary text-sm text-red-600 shrink-0"
            onClick={() => onChange('')}
          >
            Clear
          </button>
        ) : null}
      </div>
      {value ? (
        <img
          src={value}
          alt=""
          className="h-36 w-full max-w-md rounded-xl border border-gray-200 object-cover"
        />
      ) : null}
    </div>
  );
}
