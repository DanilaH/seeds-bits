package com.seedsbits.game.preview;

import android.content.Context;
import com.yandex.mobile.ads.common.ImpressionData;
import io.appmetrica.analytics.AdRevenue;
import io.appmetrica.analytics.AdType;
import io.appmetrica.analytics.AppMetrica;
import java.math.BigDecimal;
import java.util.Currency;
import org.json.JSONObject;

/** One monetary report per SDK impression; never invent revenue from impression counts. */
final class SeedsAdRevenue {
  static void report(Context context,String kind,ImpressionData impression) {
    if(impression==null || context.getResources().getBoolean(R.bool.ads_test_mode) || context.getString(R.string.appmetrica_api_key).isEmpty())return;
    try {
      JSONObject raw=new JSONObject(impression.getRawData());
      BigDecimal revenue=new BigDecimal(raw.getString("revenue"));
      if(revenue.signum()<0)return;
      Currency currency=Currency.getInstance(raw.getString("currency"));
      JSONObject network=raw.optJSONObject("network");
      AdType type=kind.equals("banner")?AdType.BANNER:kind.equals("rewarded")?AdType.REWARDED:AdType.INTERSTITIAL;
      AdRevenue report=AdRevenue.newBuilder(revenue,currency)
        .withAdNetwork(network==null?"Yandex":network.optString("name","Yandex"))
        .withAdType(type).withAdUnitId(raw.optString("ad_unit_id",""))
        .withPrecision(raw.optString("precision","unknown")).build();
      AppMetrica.reportAdRevenue(report);
    }catch(Exception ignored){/* Missing/invalid ILRD must not become fictional zero revenue. */}
  }
}
