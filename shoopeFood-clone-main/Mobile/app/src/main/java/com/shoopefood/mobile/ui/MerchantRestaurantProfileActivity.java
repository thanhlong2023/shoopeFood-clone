package com.shoopefood.mobile.ui;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.shoopefood.mobile.R;
import com.shoopefood.mobile.model.ApiMessageResponse;
import com.shoopefood.mobile.model.MerchantApplicationRequest;
import com.shoopefood.mobile.model.Restaurant;
import com.shoopefood.mobile.model.RestaurantUpdateRequest;
import com.shoopefood.mobile.model.RestaurantUpdateResponse;
import com.shoopefood.mobile.model.RestaurantsResponse;
import com.shoopefood.mobile.network.ApiClient;
import com.shoopefood.mobile.network.ApiService;
import com.shoopefood.mobile.session.SessionManager;
import com.shoopefood.mobile.util.OperatingStatusUtils;
import com.shoopefood.mobile.util.RoleRouter;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MerchantRestaurantProfileActivity extends AppCompatActivity {

    private ApiService apiService;
    private SessionManager sessionManager;
    private final List<Restaurant> restaurants = new ArrayList<>();
    private Restaurant restaurant;

    private Spinner restaurantSpinner;
    private RadioGroup statusGroup;
    private RadioButton statusOpen;
    private RadioButton statusClosedToday;
    private RadioButton statusClosed;
    private TextInputLayout closeReasonLayout;
    private TextInputEditText closeReasonInput;
    private TextInputEditText nameInput;
    private TextInputEditText addressInput;
    private TextInputEditText phoneInput;
    private TextInputEditText promotionInput;
    private TextInputEditText descriptionInput;
    private TextInputEditText avatarInput;
    private TextInputEditText coverInput;
    private TextInputEditText latitudeInput;
    private TextInputEditText longitudeInput;
    private MaterialButton saveButton;
    private MaterialButton addBranchButton;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_merchant_restaurant_profile);

        apiService = ApiClient.getService(this);
        sessionManager = new SessionManager(this);

        if (!sessionManager.isLoggedIn() || !RoleRouter.ROLE_MERCHANT.equals(sessionManager.getUser().role)) {
            finish();
            return;
        }

        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle(R.string.merchant_profile_title);
        }

        bindViews();
        loadRestaurants();
    }

    @Override
    public boolean onSupportNavigateUp() {
        finish();
        return true;
    }

    private void bindViews() {
        restaurantSpinner = findViewById(R.id.spinnerRestaurant);
        statusGroup = findViewById(R.id.radioOperatingStatus);
        statusOpen = findViewById(R.id.radioStatusOpen);
        statusClosedToday = findViewById(R.id.radioStatusClosedToday);
        statusClosed = findViewById(R.id.radioStatusClosed);
        closeReasonLayout = findViewById(R.id.layoutCloseReason);
        closeReasonInput = findViewById(R.id.inputCloseReason);
        nameInput = findViewById(R.id.inputRestaurantName);
        addressInput = findViewById(R.id.inputRestaurantAddress);
        phoneInput = findViewById(R.id.inputRestaurantPhone);
        promotionInput = findViewById(R.id.inputRestaurantPromotion);
        descriptionInput = findViewById(R.id.inputRestaurantDescription);
        avatarInput = findViewById(R.id.inputAvatarUrl);
        coverInput = findViewById(R.id.inputCoverUrl);
        latitudeInput = findViewById(R.id.inputLatitude);
        longitudeInput = findViewById(R.id.inputLongitude);
        saveButton = findViewById(R.id.buttonSaveProfile);
        addBranchButton = findViewById(R.id.buttonAddBranch);
        progressBar = findViewById(R.id.progressProfile);

        statusGroup.setOnCheckedChangeListener((group, checkedId) -> {
            closeReasonLayout.setVisibility(checkedId == R.id.radioStatusClosedToday ? View.VISIBLE : View.GONE);
        });

        restaurantSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position >= 0 && position < restaurants.size()) {
                    restaurant = restaurants.get(position);
                    bindRestaurant(restaurant);
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });

        saveButton.setOnClickListener(v -> saveProfile());
        addBranchButton.setOnClickListener(v -> showAddBranchDialog());
    }

    private void loadRestaurants() {
        progressBar.setVisibility(View.VISIBLE);
        apiService.getMyRestaurants().enqueue(new Callback<RestaurantsResponse>() {
            @Override
            public void onResponse(Call<RestaurantsResponse> call, Response<RestaurantsResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (!response.isSuccessful() || response.body() == null || response.body().data == null) {
                    Toast.makeText(MerchantRestaurantProfileActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }

                restaurants.clear();
                restaurants.addAll(response.body().data);
                setupRestaurantSpinner();

                if (restaurants.isEmpty()) {
                    Toast.makeText(MerchantRestaurantProfileActivity.this, R.string.empty_restaurants, Toast.LENGTH_LONG).show();
                    return;
                }

                restaurant = restaurants.get(0);
                bindRestaurant(restaurant);
            }

            @Override
            public void onFailure(Call<RestaurantsResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(MerchantRestaurantProfileActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void setupRestaurantSpinner() {
        List<String> labels = new ArrayList<>();
        for (Restaurant item : restaurants) {
            String status = item.approvalStatus != null ? item.approvalStatus : "PENDING";
            labels.add(item.name + " (#" + item.id + " · " + status + ")");
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels);
        restaurantSpinner.setAdapter(adapter);
    }

    private void bindRestaurant(Restaurant item) {
        nameInput.setText(item.name);
        addressInput.setText(item.address);
        phoneInput.setText(item.phone);
        promotionInput.setText(item.promotionText);
        descriptionInput.setText(item.description);
        avatarInput.setText(item.avatarUrl);
        coverInput.setText(item.imageUrl);
        latitudeInput.setText(String.valueOf(item.latitude));
        longitudeInput.setText(String.valueOf(item.longitude));
        closeReasonInput.setText(item.temporaryClosedReason);

        String status = OperatingStatusUtils.toOperatingStatus(item.isOpen, item.isOpenToday);
        if (OperatingStatusUtils.CLOSED.equals(status)) {
            statusClosed.setChecked(true);
        } else if (OperatingStatusUtils.CLOSED_TODAY.equals(status)) {
            statusClosedToday.setChecked(true);
        } else {
            statusOpen.setChecked(true);
        }
        closeReasonLayout.setVisibility(statusClosedToday.isChecked() ? View.VISIBLE : View.GONE);
    }

    private void showAddBranchDialog() {
        View dialogView = getLayoutInflater().inflate(R.layout.dialog_apply_merchant, null);
        TextInputEditText nameInputDialog = dialogView.findViewById(R.id.inputRestaurantName);
        TextInputEditText addressInputDialog = dialogView.findViewById(R.id.inputRestaurantAddress);
        TextInputEditText latInputDialog = dialogView.findViewById(R.id.inputLatitude);
        TextInputEditText lngInputDialog = dialogView.findViewById(R.id.inputLongitude);

        new AlertDialog.Builder(this)
                .setTitle(R.string.add_branch)
                .setView(dialogView)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.submit_application, (dialog, which) -> {
                    String name = nameInputDialog.getText() != null ? nameInputDialog.getText().toString().trim() : "";
                    String address = addressInputDialog.getText() != null ? addressInputDialog.getText().toString().trim() : "";
                    String latValue = latInputDialog.getText() != null ? latInputDialog.getText().toString().trim() : "10.7769";
                    String lngValue = lngInputDialog.getText() != null ? lngInputDialog.getText().toString().trim() : "106.7009";
                    if (name.isEmpty() || address.isEmpty()) {
                        Toast.makeText(this, R.string.login_required, Toast.LENGTH_SHORT).show();
                        return;
                    }
                    try {
                        submitBranch(name, address, Double.parseDouble(latValue), Double.parseDouble(lngValue));
                    } catch (NumberFormatException ex) {
                        Toast.makeText(this, R.string.invalid_distance, Toast.LENGTH_SHORT).show();
                    }
                })
                .show();
    }

    private void submitBranch(String name, String address, double lat, double lng) {
        progressBar.setVisibility(View.VISIBLE);
        apiService.applyMerchant(new MerchantApplicationRequest(
                name, address, lat, lng, "07:00:00", "22:00:00", null
        )).enqueue(new Callback<ApiMessageResponse>() {
            @Override
            public void onResponse(Call<ApiMessageResponse> call, Response<ApiMessageResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (response.isSuccessful()) {
                    Toast.makeText(MerchantRestaurantProfileActivity.this, R.string.application_sent, Toast.LENGTH_LONG).show();
                    loadRestaurants();
                } else {
                    Toast.makeText(MerchantRestaurantProfileActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ApiMessageResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(MerchantRestaurantProfileActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void saveProfile() {
        if (restaurant == null) {
            return;
        }

        String name = getText(nameInput);
        String address = getText(addressInput);
        if (TextUtils.isEmpty(name) || TextUtils.isEmpty(address)) {
            Toast.makeText(this, R.string.login_required, Toast.LENGTH_SHORT).show();
            return;
        }

        double lat;
        double lng;
        try {
            lat = Double.parseDouble(getText(latitudeInput));
            lng = Double.parseDouble(getText(longitudeInput));
        } catch (NumberFormatException ex) {
            Toast.makeText(this, R.string.invalid_distance, Toast.LENGTH_SHORT).show();
            return;
        }

        String operatingStatus;
        if (statusClosed.isChecked()) {
            operatingStatus = OperatingStatusUtils.CLOSED;
        } else if (statusClosedToday.isChecked()) {
            operatingStatus = OperatingStatusUtils.CLOSED_TODAY;
        } else {
            operatingStatus = OperatingStatusUtils.OPEN;
        }

        OperatingStatusUtils.StatusFlags flags = OperatingStatusUtils.fromOperatingStatus(operatingStatus);

        RestaurantUpdateRequest request = new RestaurantUpdateRequest();
        request.name = name;
        request.address = address;
        request.phone = getText(phoneInput);
        request.description = getText(descriptionInput);
        request.promotionText = getText(promotionInput);
        request.avatarUrl = getText(avatarInput);
        request.imageUrl = getText(coverInput);
        request.latitude = lat;
        request.longitude = lng;
        request.isOpen = flags.isOpen;
        request.isOpenToday = flags.isOpenToday;
        request.temporaryClosedReason = OperatingStatusUtils.CLOSED_TODAY.equals(operatingStatus)
                ? getText(closeReasonInput)
                : null;
        request.temporaryClosedUntil = null;

        setSaving(true);
        apiService.updateRestaurant(restaurant.id, request).enqueue(new Callback<RestaurantUpdateResponse>() {
            @Override
            public void onResponse(Call<RestaurantUpdateResponse> call, Response<RestaurantUpdateResponse> response) {
                setSaving(false);
                if (!response.isSuccessful()) {
                    Toast.makeText(MerchantRestaurantProfileActivity.this, ApiClient.parseErrorMessage(response.raw()), Toast.LENGTH_LONG).show();
                    return;
                }
                Toast.makeText(MerchantRestaurantProfileActivity.this, R.string.profile_saved, Toast.LENGTH_LONG).show();
                if (response.body() != null && response.body().data != null && response.body().data.restaurant != null) {
                    Restaurant updated = response.body().data.restaurant;
                    for (int i = 0; i < restaurants.size(); i++) {
                        if (restaurants.get(i).id == updated.id) {
                            restaurants.set(i, updated);
                            break;
                        }
                    }
                    restaurant = updated;
                    setupRestaurantSpinner();
                    bindRestaurant(restaurant);
                }
            }

            @Override
            public void onFailure(Call<RestaurantUpdateResponse> call, Throwable t) {
                setSaving(false);
                Toast.makeText(MerchantRestaurantProfileActivity.this, R.string.network_error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private String getText(TextInputEditText input) {
        return input.getText() != null ? input.getText().toString().trim() : "";
    }

    private void setSaving(boolean saving) {
        progressBar.setVisibility(saving ? View.VISIBLE : View.GONE);
        saveButton.setEnabled(!saving);
        saveButton.setText(saving ? R.string.saving : R.string.save_restaurant_profile);
    }
}
