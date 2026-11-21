import {describe, expect, it} from "vitest";
import {resolveLocale, choice, launchLanguages} from "../src/i18n";
import {identifyPortal} from "../src/distribution";
import notes from "../src/i18n/launch-copy.json";
import ui from "../src/i18n/ui-copy.json";
import registry from "../src/distribution-channels.json";

describe("distribution and locale contracts",()=>{
  it("keeps the 41 planned channels and separates portal from distributor",()=>{
    expect(registry.channels).toHaveLength(41);
    expect(new Set(registry.channels.map(x=>x.id)).size).toBe(41);
    expect(identifyPortal({sdkPortal:"ok_games",distributor:"gamepush"})).toEqual({
      portal_id:"ok_games",distributor_id:"gamepush",portal_evidence:"sdk",
    });
    expect(identifyPortal({buildPortal:"ok_games",distributor:"gamepush"})).toMatchObject({
      portal_id:"unknown",distributor_id:"gamepush",
    });
    expect(identifyPortal({buildPortal:"yandex_games",sdkPortal:"ok_games"}).portal_evidence).toBe("conflict");
  });
  it("preserves explicit choice, portal-specific fallback and the requested language",()=>{
    expect(resolveLocale("auto","en",["ru-RU"])).toMatchObject({ui:"en",source:"portal",requested:"en"});
    expect(resolveLocale("ru","en",["ru-RU"])).toMatchObject({ui:"ru",source:"manual",requested:"en"});
    expect(resolveLocale("auto","kk",["tr"],"yandex_games")).toMatchObject({ui:"ru",reason:"unsupported"});
    expect(resolveLocale("auto","nl-NL",["ru"],"crazygames")).toMatchObject({ui:"en",requested:"nl-NL"});
    expect(resolveLocale("auto",undefined,["nl-NL","pt-PT"])).toMatchObject({ui:"pt-BR",requested:"nl-NL"});
    expect(resolveLocale("auto","pt-PT",["ru"])).toMatchObject({ui:"pt-BR",requested:"pt-PT"});
    expect(choice("vi")).toBe("auto");
  });
  it("contains the complete input pack and five nonempty runtime catalogues",()=>{
    expect(Object.keys(notes.messages)).toHaveLength(118);
    for(const [id,message] of Object.entries(notes.messages))
      for(const lang of notes.locales) expect((message as Record<string,string>)[lang],id+" "+lang).toBeTruthy();
    for(const [id,message] of Object.entries(ui))
      for(const lang of launchLanguages) expect((message as Record<string,string>)[lang],id+" "+lang).toBeTruthy();
    expect(Object.keys(notes.plurals)).toHaveLength(2);
  });
});
