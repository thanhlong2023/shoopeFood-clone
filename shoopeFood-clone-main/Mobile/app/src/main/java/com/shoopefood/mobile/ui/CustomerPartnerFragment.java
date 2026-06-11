package com.shoopefood.mobile.ui;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.ActivateRoleRequest;
import com.shoopefood.mobile.model.ApiMessageResponse;
import com.shoopefood.mobile.model.ApplicationStatusData;
import com.shoopefood.mobile.model.ApplicationStatusResponse;
import com.shoopefood.mobile.model.AuthSession;
import com.shoopefood.mobile.model.DriverApplicationRequest;
import com.shoopefood.mobile.model.LoginResponse;
import com.shoopefood.mobile.model.MerchantApplicationRequest;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.RoleRouter;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerPartnerFragment extends Fragment {

    private ApiService apiService;
    private SessionManager sessionManager;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView statusText;
    private MaterialButton applyDriverButton;
    private MaterialButton applyMerchantButton;
    private final Handler pollHandler = new Handler(Looper.getMainLooper());
    private final Runnable pollRunnable = this::loadApplicationStatus;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_customer_partner, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getService(requireContext());
        sessionManager = new SessionManager(requireContext());

        swipeRefreshLayout = view.findViewById(R.id.swipeRefreshCustomerPartner);
        progressBar = view.findViewById(R.id.progressCustomerPartner);
        statusText = view.findViewById(R.id.textPartnerStatus);
        applyDriverButton = view.findViewById(R.id.buttonApplyDriver);
        applyMerchantButton = view.findViewById(R.id.buttonApplyMerchant);

        swipeRefreshLayout.setColorSchemeResources(R.color.brand_green);
        swipeRefreshLayout.setOnRefreshListener(this::loadApplicationStatus);
        applyDriverButton.setOnClickListener(v -> showApplyDriverDialog());
        applyMerchantButton.setOnClickListener(v -> showApplyMerchantDialog());

        loadApplicationStatus();
    }

    @Override
    public void onResume() {
        super.onResume();
        pollHandler.postDelayed(pollRunnable, 4000L);
    }

    @Override
    public void onPause() {
        pollHandler.removeCallbacks(pollRunnable);
        super.onPause();
    }

    private void loadApplicationStatus() {
        if (!swipeRefreshLayout.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }

        apiService.getMyApplicationStatus().enqueue(new Callback<ApplicationStatusResponse>() {
            @Override
            public void onResponse(@NonNull Call<ApplicationStatusResponse> call, @NonNull Response<ApplicationStatusResponse> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);

                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }

                bindStatus(response.body().data);
            }

            @Override
            public void onFailure(@NonNull Call<ApplicationStatusResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefreshLayout.setRefreshing(false);
            }
        });
    }

    private void bindStatus(ApplicationStatusData status) {
        statusText.setVisibility(View.GONE);
        applyDriverButton.setEnabled(true);
        applyMerchantButton.setEnabled(true);

        if (status.driver != null) {
            String approval = status.driver.approvalStatus == null ? "" : status.driver.approvalStatus.toUpperCase();
            if ("PENDING".equals(approval)) {
                statusText.setVisibility(View.VISIBLE);
                statusText.setText(R.string.customer_status_driver_pending);
                applyDriverButton.setEnabled(false);
            } else if ("APPROVED".equals(approval)) {
                statusText.setVisibility(View.VISIBLE);
                statusText.setText(R.string.customer_status_driver_approved);
                activateRoleAndRedirect(RoleRouter.ROLE_DRIVER);
                return;
            }
        }

        if (status.merchant != null) {
            if (status.merchant.pendingRestaurant != null) {
                statusText.setVisibility(View.VISIBLE);
                statusText.setText(getString(
                        R.string.customer_status_merchant_pending,
                        status.merchant.pendingRestaurant.name
                ));
                applyMerchantButton.setEnabled(false);
            } else if (status.merchant.approvedRestaurant != null) {
                statusText.setVisibility(View.VISIBLE);
                statusText.setText(R.string.customer_status_merchant_approved);
                activateRoleAndRedirect(RoleRouter.ROLE_MERCHANT);
            }
        }
    }

    private void activateRoleAndRedirect(String role) {
        apiService.activateRole(new ActivateRoleRequest(role)).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(@NonNull Call<LoginResponse> call, @NonNull Response<LoginResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    return;
                }
                AuthSession session = response.body().data;
                sessionManager.saveSession(session.token, session.user);
                Intent intent = RoleRouter.getHomeIntent(requireContext(), session.user.role);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                requireActivity().finish();
            }

            @Override
            public void onFailure(@NonNull Call<LoginResponse> call, @NonNull Throwable t) {
            }
        });
    }

    private void showApplyDriverDialog() {
        View dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_apply_driver, null, false);
        TextInputEditText licenseInput = dialogView.findViewById(R.id.inputLicensePlate);
        TextInputEditText idCardInput = dialogView.findViewById(R.id.inputIdCardNumber);
        TextInputEditText vehicleInput = dialogView.findViewById(R.id.inputVehicleType);

        new AlertDialog.Builder(requireContext())
                .setTitle(R.string.customer_partner_apply_driver)
                .setView(dialogView)
                .setPositiveButton(R.string.submit_application, (dialog, which) -> {
                    String licensePlate = textOf(licenseInput);
                    String idCardNumber = textOf(idCardInput);
                    String vehicleType = textOf(vehicleInput);
                    if (TextUtils.isEmpty(licensePlate) || TextUtils.isEmpty(idCardNumber)) {
                        Toast.makeText(requireContext(), R.string.customer_driver_apply_required, Toast.LENGTH_SHORT).show();
                        return;
                    }
                    submitDriverApplication(licensePlate, idCardNumber, vehicleType);
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void submitDriverApplication(String licensePlate, String idCardNumber, String vehicleType) {
        progressBar.setVisibility(View.VISIBLE);
        apiService.applyDriver(new DriverApplicationRequest(
                licensePlate,
                idCardNumber,
                TextUtils.isEmpty(vehicleType) ? "Motorbike" : vehicleType
        )).enqueue(new Callback<ApiMessageResponse>() {
            @Override
            public void onResponse(@NonNull Call<ApiMessageResponse> call, @NonNull Response<ApiMessageResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (!response.isSuccessful()) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }
                Toast.makeText(requireContext(), R.string.customer_driver_apply_success, Toast.LENGTH_SHORT).show();
                loadApplicationStatus();
            }

            @Override
            public void onFailure(@NonNull Call<ApiMessageResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showApplyMerchantDialog() {
        View dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_apply_merchant, null, false);
        TextInputEditText nameInput = dialogView.findViewById(R.id.inputRestaurantName);
        TextInputEditText addressInput = dialogView.findViewById(R.id.inputRestaurantAddress);
        TextInputEditText latInput = dialogView.findViewById(R.id.inputLatitude);
        TextInputEditText lngInput = dialogView.findViewById(R.id.inputLongitude);

        new AlertDialog.Builder(requireContext())
                .setTitle(R.string.customer_partner_apply_merchant)
                .setView(dialogView)
                .setPositiveButton(R.string.submit_application, (dialog, which) -> {
                    String name = textOf(nameInput);
                    String address = textOf(addressInput);
                    if (TextUtils.isEmpty(name) || TextUtils.isEmpty(address)) {
                        Toast.makeText(requireContext(), R.string.checkout_required, Toast.LENGTH_SHORT).show();
                        return;
                    }
                    double latitude = parseDouble(textOf(latInput), 10.7769);
                    double longitude = parseDouble(textOf(lngInput), 106.7009);
                    submitMerchantApplication(name, address, latitude, longitude);
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void submitMerchantApplication(String name, String address, double latitude, double longitude) {
        progressBar.setVisibility(View.VISIBLE);
        apiService.applyMerchant(new MerchantApplicationRequest(
                name,
                address,
                latitude,
                longitude,
                "07:00:00",
                "22:00:00",
                null
        )).enqueue(new Callback<ApiMessageResponse>() {
            @Override
            public void onResponse(@NonNull Call<ApiMessageResponse> call, @NonNull Response<ApiMessageResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (!response.isSuccessful()) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }
                Toast.makeText(requireContext(), R.string.application_sent, Toast.LENGTH_SHORT).show();
                loadApplicationStatus();
            }

            @Override
            public void onFailure(@NonNull Call<ApiMessageResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private double parseDouble(String value, double fallback) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private String textOf(TextInputEditText input) {
        return input.getText() == null ? "" : input.getText().toString().trim();
    }
}
