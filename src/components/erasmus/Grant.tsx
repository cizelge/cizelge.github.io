"use client";

import { useId } from "react";
import { ERASMUS_LIMITS, type ErasmusProfile } from "@/lib/erasmus/prefill";
import { grantEstimate } from "@/lib/erasmus/score";
import type { ErasmusData } from "@/lib/erasmus/types";
import { parseDecimalInput } from "@/lib/transfer/profile-storage";
import { formatEuro, formatNumber, NumberField } from "./NumberField";

interface Props {
  data: ErasmusData;
  grant: ErasmusProfile["grant"];
  onGrant: (patch: Partial<ErasmusProfile["grant"]>) => void;
}

/** Varsayılan süre: bir dönem için hibeli ay sayısı, veri aralığında. */
function defaultMonths(data: ErasmusData): number {
  return Math.min(Math.max(data.grant.maxFundedMonths, data.durationMonths.min), data.durationMonths.max);
}

export function Grant({ data, grant, onGrant }: Props) {
  const id = useId();
  const groups = data.grant.monthly;
  const group = groups.find((g) => g.group === grant.group) ?? groups[0];
  const months = grant.months !== null && grant.months >= data.durationMonths.min && grant.months <= data.durationMonths.max ? grant.months : defaultMonths(data);
  const monthChoices = Array.from({ length: data.durationMonths.max - data.durationMonths.min + 1 }, (_, i) => data.durationMonths.min + i);

  if (!group) return null;
  const result = grantEstimate(data, { group: group.group, months, km: grant.km, green: grant.green, disadvantaged: grant.disadvantaged });
  const unfunded = months - result.fundedMonths;
  const minTravelKm = Math.min(...data.grant.travel.map((t) => t.minKm));

  return (
    <section aria-labelledby={id} className="er-section">
      <h2 className="group-title er-h2" id={id}>
        Hibe tahmini
      </h2>

      <div className="er-grant-fields">
        <label className="field er-grant-group">
          <span className="field-label">Gideceğin ülkenin grubu</span>
          <select className="select" value={group.group} aria-describedby={`${id}-c`} onChange={(e) => onGrant({ group: e.target.value })}>
            {groups.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group}: ayda {formatEuro(g.euro)}
              </option>
            ))}
          </select>
          {group.countries && (
            <span className="hint gc-small" id={`${id}-c`}>
              {group.countries}
            </span>
          )}
        </label>

        <label className="field">
          <span className="field-label">Süre</span>
          <select className="select" value={months} onChange={(e) => onGrant({ months: Number(e.target.value) })}>
            {monthChoices.map((m) => (
              <option key={m} value={m}>
                {m} ay
              </option>
            ))}
          </select>
        </label>

        <NumberField
          label="Mesafe (km)"
          value={grant.km}
          placeholder="1.800"
          parse={(t) => parseDecimalInput(t.replace(/\.(?=\d{3}\b)/g, ""))}
          format={(n) => formatNumber(n, 0)}
          limits={ERASMUS_LIMITS.km}
          error="Geçerli bir mesafe yaz."
          hint="İsteğe bağlı. Seyahat desteği için."
          onChange={(v) => onGrant({ km: v })}
        />
      </div>

      <div className="er-toggles">
        <label className="gc-toggle">
          <input type="checkbox" checked={grant.green} onChange={(e) => onGrant({ green: e.target.checked })} />
          Yeşil seyahat (tren, otobüs, paylaşımlı araç)
        </label>
        <label className="gc-toggle">
          <input type="checkbox" checked={grant.disadvantaged} onChange={(e) => onGrant({ disadvantaged: e.target.checked })} />
          Dezavantajlı öğrenciyim (ayda +{formatEuro(data.grant.disadvantagedMonthly)})
        </label>
      </div>

      <div className="er-grant-result" aria-live="polite">
        <p className="er-grant-total">
          Toplam yaklaşık <b className="num">{formatEuro(result.total)}</b>
        </p>
        <p className="er-line num">
          Ayda {formatEuro(result.monthly)} × {result.fundedMonths} ay = {formatEuro(result.monthly * result.fundedMonths)}
          {result.travel !== null
            ? `, seyahat ${formatEuro(result.travel)}.`
            : grant.km === null
              ? ". Seyahat desteği için mesafeyi yaz."
              : `. ${formatNumber(minTravelKm)} km'nin altında seyahat desteği yok.`}
        </p>
        <p className="hint gc-small">
          Hibe en fazla {data.grant.maxFundedMonths} ay için ödenir
          {unfunded > 0 ? `; kalan ${unfunded} ay hibesiz.` : "."} Tutarlar {data.callYear} çağrısına ait; yeni çağrıda değişebilir.
        </p>
      </div>
    </section>
  );
}
