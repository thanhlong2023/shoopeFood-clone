package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.LoginRequest;
import com.shoopefood.mobile.model.LoginResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.RoleRouter;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    public static final String EXTRA_LOGIN_ROLE = "login_role";

    private TextView loginTitle;
    private TextInputEditText phoneInput;
    private TextInputEditText passwordInput;
    private MaterialButton loginButton;
    private MaterialButton switchCustomerButton;
    private MaterialButton switchMerchantButton;
    private MaterialButton switchDriverButton;
    private ProgressBar progressBar;
    private SessionManager sessionManager;
    private ApiService apiService;
    private String loginRole = RoleRouter.ROLE_CUSTOMER;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        sessionManager = new SessionManager(this);
        apiService = ApiClient.getService(this);

        if (getIntent().hasExtra(EXTRA_LOGIN_ROLE)) {
            loginRole = getIntent().getStringExtra(EXTRA_LOGIN_ROLE);
        }

        if (sessionManager.isLoggedIn()) {
            openHomeForRole(sessionManager.getUser().role);
            return;
        }

        loginTitle = findViewById(R.id.textLoginTitle);
        phoneInput = findViewById(R.id.inputPhone);
        passwordInput = findViewById(R.id.inputPassword);
        loginButton = findViewById(R.id.buttonLogin);
        switchCustomerButton = findViewById(R.id.buttonSwitchCustomer);
        switchMerchantButton = findViewById(R.id.buttonSwitchMerchant);
        switchDriverButton = findViewById(R.id.buttonSwitchDriver);
        progressBar = findViewById(R.id.progressLogin);

        applyRoleDefaults();
        passwordInput.setText("123456");

        updateRoleUi();
        loginButton.setOnClickListener(v -> attemptLogin());
        switchCustomerButton.setOnClickListener(v -> switchRole(RoleRouter.ROLE_CUSTOMER));
        switchMerchantButton.setOnClickListener(v -> switchRole(RoleRouter.ROLE_MERCHANT));
        switchDriverButton.setOnClickListener(v -> switchRole(RoleRouter.ROLE_DRIVER));
    }

    private void switchRole(String role) {
        loginRole = role;
        applyRoleDefaults();
        updateRoleUi();
    }

    private void applyRoleDefaults() {
        if (RoleRouter.ROLE_MERCHANT.equals(loginRole)) {
            loginTitle.setText(R.string.login_title_merchant);
            phoneInput.setText("0900000003");
        } else if (RoleRouter.ROLE_DRIVER.equals(loginRole)) {
            loginTitle.setText(R.string.login_title_driver);
            phoneInput.setText("0900000002");
        } else {
            loginTitle.setText(R.string.login_title);
            phoneInput.setText("0900000001");
        }
    }

    private void updateRoleUi() {
        switchCustomerButton.setEnabled(!RoleRouter.ROLE_CUSTOMER.equals(loginRole));
        switchMerchantButton.setEnabled(!RoleRouter.ROLE_MERCHANT.equals(loginRole));
        switchDriverButton.setEnabled(!RoleRouter.ROLE_DRIVER.equals(loginRole));
    }

    private void attemptLogin() {
        String phone = phoneInput.getText() != null ? phoneInput.getText().toString().trim() : "";
        String password = passwordInput.getText() != null ? passwordInput.getText().toString() : "";

        if (phone.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, R.string.login_required, Toast.LENGTH_SHORT).show();
            return;
        }

        setLoading(true);

        LoginRequest request = new LoginRequest(phone, password, loginRole);
        apiService.login(request).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                setLoading(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(
                            LoginActivity.this,
                            ApiClient.parseErrorMessage(response.raw()),
                            Toast.LENGTH_LONG
                    ).show();
                    return;
                }

                String role = response.body().data.user.role;
                if (RoleRouter.isBlockedOnMobile(role)) {
                    Toast.makeText(LoginActivity.this, RoleRouter.getBlockedMessage(role), Toast.LENGTH_LONG).show();
                    return;
                }

                sessionManager.saveSession(response.body().data.token, response.body().data.user);
                openHomeForRole(role);
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                setLoading(false);
                Toast.makeText(LoginActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void openHomeForRole(String role) {
        startActivity(RoleRouter.getHomeIntent(this, role));
        finish();
    }

    private void setLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        loginButton.setEnabled(!loading);
    }
}
