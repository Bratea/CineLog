package com.cinelog.app;

import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String RUNTIME_PREFS = "cinelog_runtime";
    private static final String WEB_ASSETS_VERSION = "web_assets_version";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null) return;

        SharedPreferences preferences = getSharedPreferences(RUNTIME_PREFS, MODE_PRIVATE);
        int currentAssetsVersion;
        try {
            currentAssetsVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (android.content.pm.PackageManager.NameNotFoundException exception) {
            return;
        }
        if (preferences.getInt(WEB_ASSETS_VERSION, -1) == currentAssetsVersion) return;

        preferences.edit().putInt(WEB_ASSETS_VERSION, currentAssetsVersion).apply();
        getBridge().getWebView().post(() -> {
            getBridge().getWebView().clearCache(true);
            getBridge().reload();
        });
    }
}
