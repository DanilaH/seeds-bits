package com.seedsbits.game.preview;

import android.content.Context;
import com.yandex.mobile.ads.common.ImpressionData;
import io.appmetrica.analytics.AdRevenue;
import io.appmetrica.analytics.AdType;
import io.appmetrica.analytics.AppMetrica;
import java.math.BigDecimal;
import java.util.Currency;
import java.util.Map;
import java.util.HashMap;
import java.util.WeakHashMap;
import java.util.UUID;
import org.json.JSONArray;
import com.getcapacitor.JSObject;
import org.json.JSONObject;

/** One monetary report per SDK impression; never invent revenue from impression counts. */
final class SeedsAdRevenue {
  private static final Map<ImpressionData,String> bannerIds = new WeakHashMap<>();
  static synchronized void report(Context context,String kind,ImpressionData impression) {
    String id = impression == null ? UUID.randomUUID().toString() : bannerIds.computeIfAbsent(impression, ignored -> UUID.randomUUID().toString());
    report(context,kind,impression,id,"banner");
  }
  static synchronized void report(Context context,String kind,ImpressionData impression,String impressionId,String adSession) {
    if(context.getResources().getBoolean(R.bool.ads_test_mode) || context.getString(R.string.appmetrica_api_key).isEmpty())return;
    android.content.SharedPreferences prefs = context.getSharedPreferences("seeds-monetization",0);
    JSObject status = new JSObject().put("impression_id",impressionId).put("ad_session_id",adSession).put("format",kind).put("valid",false);
    try {
      if (impression == null) throw new IllegalArgumentException("Missing ILRD");
      JSONObject raw=new JSONObject(impression.getRawData());
      BigDecimal revenue=new BigDecimal(raw.getString("revenue"));
      if(revenue.signum()<0) throw new IllegalArgumentException("Negative ILRD");
      Currency currency=Currency.getInstance(raw.getString("currency"));
      JSONObject network=raw.optJSONObject("network");
      AdType type=kind.equals("banner")?AdType.BANNER:kind.equals("rewarded")?AdType.REWARDED:AdType.INTERSTITIAL;
      Map<String,String> payload = new HashMap<>();
      payload.put("format",kind); payload.put("impression_id",impressionId); payload.put("ad_session_id",adSession); payload.put("dataset","manual-ilrd-v1");
      for (String key : new String[]{"install","experiment","variant","config","anchor","cohort","qa"})
        payload.put(key,prefs.getString("context_"+key,"unknown"));
      JSONArray ids;
      try { ids = new JSONArray(prefs.getString("revenue_receipts","[]")); } catch (Exception ignored) { ids = new JSONArray(); }
      for (int i=0;i<ids.length();i++) if (impressionId.equals(ids.optString(i))) return;
      AdRevenue report=AdRevenue.newBuilder(revenue,currency)
        .withAdNetwork(network==null?"Yandex":network.optString("name","Yandex"))
        .withAdType(type).withAdUnitId(raw.optString("ad_unit_id",""))
        .withPrecision(raw.optString("precision","unknown")).withPayload(payload).build();
      AppMetrica.reportAdRevenue(report);
      JSONArray next = new JSONArray();
      for (int i=Math.max(0,ids.length()-511);i<ids.length();i++) next.put(ids.optString(i));
      next.put(impressionId); prefs.edit().putString("revenue_receipts",next.toString()).commit();
      status.put("valid",true).put("revenue",revenue.toPlainString()).put("currency",currency.getCurrencyCode()).put("precision",raw.optString("precision","unknown"));
    }catch(Exception ignored){status.put("reason","missing_or_invalid");}
    // Coverage diagnostics are not another monetary dataset. Stable impression_id
    // also identifies the SDK enqueue/receipt crash gap in downstream exports.
    SeedsApplication.report(context,"ad_revenue_status",status);
  }
}
