export const coreFeelPilot = import.meta.env.VITE_SEEDS_CORE_FEEL === "1";
type Profile = "baseline" | "audio" | "feel";
export type SoundPack = "dry" | "pop";
const key = "seeds-bits.feel-pilot.v1";
let profile: Profile = "baseline";
let pack: SoundPack = "pop";

if (coreFeelPilot) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (stored.profile === "audio" || stored.profile === "feel") profile = stored.profile;
    if (stored.pack === "dry") pack = stored.pack;
  } catch {
    // A blocked store leaves the pilot usable for this session.
  }
}

export const feelMotion = () => coreFeelPilot && profile === "feel";
export const feelSoundPack = () => coreFeelPilot && profile !== "baseline" ? pack : undefined;

export function mountFeelPilot(settings: Element, change: () => void) {
  if (!coreFeelPilot) return;
  const fields = document.createElement("fieldset");
  fields.className = "feel-pilot";
  fields.innerHTML = `<legend>Core Feel Pilot</legend>
    <label>Profile <select id="core-feel-profile">
      <option value="baseline">Baseline</option>
      <option value="audio">Audio</option>
      <option value="feel">Feel</option>
    </select></label>
    <label>Sound pack <select id="core-feel-pack">
      <option value="pop">Pop</option>
      <option value="dry">Dry</option>
    </select></label>`;
  settings.after(fields);
  const profiles = fields.querySelector<HTMLSelectElement>("#core-feel-profile")!;
  const packs = fields.querySelector<HTMLSelectElement>("#core-feel-pack")!;
  const sync = () => {
    document.documentElement.dataset.coreFeel = profile;
    packs.disabled = profile === "baseline";
  };
  profiles.value = profile;
  packs.value = pack;
  sync();
  fields.addEventListener("change", () => {
    profile = profiles.value as Profile;
    pack = packs.value as SoundPack;
    try {
      localStorage.setItem(key, JSON.stringify({ profile, pack }));
    } catch {
      // Changing profile still works with storage disabled.
    }
    sync();
    change();
  });
}
