package com.micmax.diarioauto;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ObdBluetoothPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(GoogleDriveAuthPlugin.class);
        registerPlugin(WidgetRefreshPlugin.class);
        registerPlugin(NotificationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
