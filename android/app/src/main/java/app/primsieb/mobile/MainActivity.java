package app.primsieb.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigenes Plugin für den Geräte-Check (muss vor super.onCreate registriert werden)
        registerPlugin(HardwarePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
