"""Compile the actual pinned MessageHandler against deterministic transport doubles.

The eager plugin reply forces a valid dispatch/response interleaving. It is a
dependency race oracle, separate from real Android reload acceptance.
"""
from pathlib import Path
import hashlib,json,subprocess,tempfile,os

source=Path('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/MessageHandler.java').read_text()
before='                    postMessage(message.getData());\n                    javaScriptReplyProxy = replyProxy;'
after='                    javaScriptReplyProxy = replyProxy;\n                    postMessage(message.getData());'
assert after in source and before not in source,'npm postinstall patch must be applied'
original=source.replace(after,before)
assert hashlib.sha256(original.encode()).hexdigest()=='5fa05c9148c4e24958f72b2d81747b416a73356693a8cb99249c557fdc9dec1a'
stubs={
'android/webkit/JavascriptInterface.java':'package android.webkit; public @interface JavascriptInterface {}',
'android/webkit/WebView.java':'''package android.webkit; public class WebView {public int legacy;public void addJavascriptInterface(Object o,String s){}public void post(Runnable r){legacy++;r.run();}public void evaluateJavascript(String s,Object o){}}''',
'androidx/webkit/JavaScriptReplyProxy.java':'package androidx.webkit; public class JavaScriptReplyProxy {public int replies;public void postMessage(String s){replies++;}}',
'androidx/webkit/WebViewFeature.java':'package androidx.webkit; public class WebViewFeature {public static final String WEB_MESSAGE_LISTENER="modern";public static boolean isFeatureSupported(String s){return true;}}',
'androidx/webkit/WebViewCompat.java':'''package androidx.webkit; import android.webkit.WebView; import java.util.Set; public class WebViewCompat {public static WebMessageListener listener;public static class Message{public String getData(){return "{}";}}public interface WebMessageListener{void onPostMessage(WebView v,Message m,Object origin,boolean main,JavaScriptReplyProxy proxy);}public static void addWebMessageListener(WebView v,String n,Set<String> origins,WebMessageListener l){listener=l;}}''',
'org/apache/cordova/PluginManager.java':'package org.apache.cordova; public class PluginManager{public void exec(String a,String b,String c,String d){}}',
'com/getcapacitor/JSObject.java':'''package com.getcapacitor;public class JSObject {public JSObject(){}public JSObject(String s){}public String getString(String k){return switch(k){case "callbackId"->"reply";case "pluginId"->"Preferences";case "methodName"->"get";default->null;};}public JSObject getJSObject(String k,JSObject d){return d;}}''',
'com/getcapacitor/PluginResult.java':'package com.getcapacitor;public class PluginResult{public void put(String k,Object v){}public String toString(){return "{}";}}',
'com/getcapacitor/PluginCall.java':'''package com.getcapacitor;public class PluginCall{public static final String CALLBACK_ID_DANGLING="dangling";private String callback;public PluginCall(MessageHandler h,String p,String c,String m,JSObject d){callback=c;}public boolean isKeptAlive(){return false;}public String getCallbackId(){return callback;}public String getPluginId(){return "Preferences";}public String getMethodName(){return "get";}public void release(Bridge b){}}''',
'com/getcapacitor/Logger.java':'package com.getcapacitor;public class Logger{public static String tags(String s){return s;}public static void warn(String s){}public static void debug(String s){}public static void verbose(String a,String b){}public static void error(String s){}public static void error(String s,Exception e){}}',
'com/getcapacitor/Bridge.java':'''package com.getcapacitor;import java.util.Set;public class Bridge{public MessageHandler handler;public PluginCall delayed;public boolean defer,legacy;public int calls;public static class Config{boolean legacy;Config(boolean v){legacy=v;}public boolean isUsingLegacyBridge(){return legacy;}}public static class App{public void fireRestoredResult(PluginResult r){}}public Config getConfig(){return new Config(legacy);}public Set<String> getAllowedOriginRules(){return Set.of("https://localhost");}public App getApp(){return new App();}public void execute(Runnable r){r.run();}public void callPluginMethod(String p,String m,PluginCall c){calls++;if(defer)delayed=c;else handler.sendResponseMessage(c,new PluginResult(),null);}}''',
'com/getcapacitor/Harness.java':'''package com.getcapacitor;
import android.webkit.WebView;import androidx.webkit.*;
public class Harness{
 static void check(boolean v,String m){if(!v)throw new AssertionError(m);}
 static MessageHandler connect(Bridge b,WebView w){MessageHandler h=new MessageHandler(b,w,new org.apache.cordova.PluginManager());b.handler=h;return h;}
 static void message(WebView w,JavaScriptReplyProxy p,boolean main){WebViewCompat.listener.onPostMessage(w,new WebViewCompat.Message(),null,main,p);}
 public static void main(String[] args){boolean patched=args[0].equals("patched");
  Bridge b=new Bridge();WebView w=new WebView();connect(b,w);JavaScriptReplyProxy current=new JavaScriptReplyProxy();message(w,current,true);
  check(current.replies==(patched?1:0),"first reply path");check(w.legacy==(patched?0:1),"first fallback path");
  JavaScriptReplyProxy next=new JavaScriptReplyProxy();int old=current.replies;message(w,next,true);
  check(next.replies==(patched?1:0),"reload must address new document");check(current.replies-old==(patched?0:1),"reload old-document reply");
  int calls=b.calls;message(w,new JavaScriptReplyProxy(),false);check(b.calls==calls,"subframe must remain denied");
  b.defer=true;JavaScriptReplyProxy deferred=new JavaScriptReplyProxy();message(w,deferred,true);b.handler.sendResponseMessage(b.delayed,new PluginResult(),null);check(deferred.replies==1,"async reply unchanged");
  Bridge legacy=new Bridge();legacy.legacy=true;WebView lw=new WebView();MessageHandler lh=connect(legacy,lw);lh.postMessage("{}");check(lw.legacy==1,"explicit legacy mode unchanged");
  System.out.println("{\\"variant\\":\\""+args[0]+"\\",\\"firstReply\\":\\""+(patched?"current_proxy":"legacy_fallback")+"\\",\\"reloadReply\\":\\""+(patched?"current_document":"previous_document")+"\\",\\"subframeDenied\\":true,\\"asyncRetained\\":true,\\"legacyRetained\\":true}");
 }
}'''
}
results=[]
with tempfile.TemporaryDirectory(prefix='seeds-capacitor-bridge-') as tmp:
 root=Path(tmp)
 for variant,text in [('original',original),('patched',source)]:
  folder=root/variant
  for name,body in {**stubs,'com/getcapacitor/MessageHandler.java':text}.items():
   p=folder/'src'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body)
  files=[str(p) for p in (folder/'src').rglob('*.java')]
  subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-d',str(folder/'classes'),*files],check=True)
  result=subprocess.check_output(['java','-cp',str(folder/'classes'),'com.getcapacitor.Harness',variant],text=True)
  results.append(json.loads(result))
report={'source':os.environ.get('GITHUB_SHA'),'dependency':'@capacitor/android8.5.3','scope':'Actual MessageHandler compiled against deterministic transport/plugin scheduling doubles; real Android reload is a separate gate','unpatchedSHA256':hashlib.sha256(original.encode()).hexdigest(),'patchedSHA256':hashlib.sha256(source.encode()).hexdigest(),'results':results,'status':'PASS'}
out=Path('test-results/capacitor-bridge.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
