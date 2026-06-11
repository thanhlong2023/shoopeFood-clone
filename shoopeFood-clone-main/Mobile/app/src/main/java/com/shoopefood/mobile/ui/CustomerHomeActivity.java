package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

/** @deprecated Use {@link HomeActivity} */
@Deprecated
public class CustomerHomeActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = new Intent(this, HomeActivity.class);
        intent.putExtras(getIntent());
        startActivity(intent);
        finish();
    }
}
