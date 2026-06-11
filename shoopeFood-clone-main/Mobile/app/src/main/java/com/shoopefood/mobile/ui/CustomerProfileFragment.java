package com.shoopefood.mobile.ui;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.ApiMessageResponse;
import com.shoopefood.mobile.model.AuthUser;
import com.shoopefood.mobile.model.ChangePasswordRequest;
import com.shoopefood.mobile.model.MeResponse;
import com.shoopefood.mobile.model.UpdateProfileRequest;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;

import java.util.Locale;
import java.util.regex.Pattern;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerProfileFragment extends Fragment {

    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{6,72}$");

    private CustomerHomeHost host;
    private ApiService apiService;
    private SessionManager sessionManager;
    private TextView avatarView;
    private TextView nameView;
    private TextView phoneView;
    private TextView ratingView;
    private TextInputEditText nameInput;
    private TextInputEditText phoneInput;
    private TextInputEditText currentPasswordInput;
    private TextInputEditText newPasswordInput;
    private ProgressBar progressBar;

    @Override
    public void onAttach(@NonNull android.content.Context context) {
        super.onAttach(context);
        if (!(context instanceof CustomerHomeHost)) {
            throw new IllegalStateException("Host must implement CustomerHomeHost");
        }
        host = (CustomerHomeHost) context;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_customer_profile, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        apiService = ApiClient.getService(requireContext());
        sessionManager = new SessionManager(requireContext());

        avatarView = view.findViewById(R.id.textProfileAvatar);
        nameView = view.findViewById(R.id.textProfileName);
        phoneView = view.findViewById(R.id.textProfilePhone);
        ratingView = view.findViewById(R.id.textProfileRating);
        nameInput = view.findViewById(R.id.inputProfileName);
        phoneInput = view.findViewById(R.id.inputProfilePhone);
        currentPasswordInput = view.findViewById(R.id.inputCurrentPassword);
        newPasswordInput = view.findViewById(R.id.inputNewPassword);
        progressBar = view.findViewById(R.id.progressCustomerProfile);
        MaterialButton saveProfileButton = view.findViewById(R.id.buttonSaveProfile);
        MaterialButton changePasswordButton = view.findViewById(R.id.buttonChangePassword);
        MaterialButton logoutButton = view.findViewById(R.id.buttonLogout);

        bindUser(sessionManager.getUser());
        saveProfileButton.setOnClickListener(v -> saveProfile());
        changePasswordButton.setOnClickListener(v -> changePassword());
        logoutButton.setOnClickListener(v -> host.logoutCustomer());
    }

    private void bindUser(AuthUser user) {
        if (user == null) {
            return;
        }
        nameView.setText(user.fullName);
        phoneView.setText(getString(R.string.driver_phone_label, user.phone));
        ratingView.setText(getString(R.string.driver_rating_label, String.format(Locale.US, "%.1f", user.ratingAvg)));
        avatarView.setText(initial(user.fullName));
        nameInput.setText(user.fullName);
        phoneInput.setText(user.phone);
    }

    private void saveProfile() {
        String fullName = textOf(nameInput);
        String phone = textOf(phoneInput);
        if (TextUtils.isEmpty(fullName) || TextUtils.isEmpty(phone)) {
            Toast.makeText(requireContext(), R.string.customer_profile_required, Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        apiService.updateProfile(new UpdateProfileRequest(fullName, phone)).enqueue(new Callback<MeResponse>() {
            @Override
            public void onResponse(@NonNull Call<MeResponse> call, @NonNull Response<MeResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }
                AuthUser updated = response.body().data;
                sessionManager.saveSession(sessionManager.getToken(), updated);
                bindUser(updated);
                Toast.makeText(requireContext(), R.string.customer_profile_saved, Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onFailure(@NonNull Call<MeResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void changePassword() {
        String currentPassword = textOf(currentPasswordInput);
        String newPassword = textOf(newPasswordInput);
        if (TextUtils.isEmpty(currentPassword) || TextUtils.isEmpty(newPassword)) {
            Toast.makeText(requireContext(), R.string.login_required, Toast.LENGTH_SHORT).show();
            return;
        }
        if (!PASSWORD_PATTERN.matcher(newPassword).matches()) {
            Toast.makeText(requireContext(), R.string.customer_password_invalid, Toast.LENGTH_LONG).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        apiService.changePassword(new ChangePasswordRequest(currentPassword, newPassword)).enqueue(new Callback<ApiMessageResponse>() {
            @Override
            public void onResponse(@NonNull Call<ApiMessageResponse> call, @NonNull Response<ApiMessageResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (!response.isSuccessful()) {
                    Toast.makeText(requireContext(), ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }
                currentPasswordInput.setText("");
                newPasswordInput.setText("");
                Toast.makeText(requireContext(), R.string.customer_password_changed, Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onFailure(@NonNull Call<ApiMessageResponse> call, @NonNull Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(requireContext(), R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private String textOf(TextInputEditText input) {
        return input.getText() == null ? "" : input.getText().toString().trim();
    }

    private String initial(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return "K";
        }
        return fullName.trim().substring(0, 1).toUpperCase(Locale.US);
    }
}
