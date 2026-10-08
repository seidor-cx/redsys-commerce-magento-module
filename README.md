# Redsys Adobe Commerce Module

Adobe Commerce module that enables Redsys payment integration for PaaS and on-premises deployments.

## Overview

This module provides the Adobe Commerce integration required to connect the Redsys payment application with Adobe Commerce PaaS and on-premises installations.

It works together with the Redsys App Builder application available through Adobe Exchange.

This module is **not required for Adobe Commerce as a Cloud Service (SaaS)** deployments.

## Requirements

The following components are required for PaaS and on-premises deployments:

* Adobe Commerce 2.4.7 or later.
* `Magento_OutOfProcessPaymentMethods`.
* The Redsys App installed from Adobe Exchange.

## Installation

### 1. Install the module

Copy the `Seidor_Redsys` module into your Adobe Commerce application:

```text
app/code/Seidor/Redsys
```

The module source is located in this repository under:

```text
app/code/Seidor/Redsys
```

### 2. Enable the required modules

From the Adobe Commerce application root, run:

```bash
bin/magento module:enable Magento_OutOfProcessPaymentMethods
bin/magento module:enable Seidor_Redsys
```

### 3. Run the Magento upgrade

```bash
bin/magento setup:upgrade
```

### 4. Clear the cache

```bash
bin/magento cache:flush
```

For production deployments, run the appropriate deployment and compilation commands according to your Adobe Commerce deployment process.

## Configuration

After installing the module:

1. Install the Redsys App from Adobe Exchange.
2. Configure the Adobe Commerce Integration required by the Redsys App.
3. Configure the Redsys App with the Adobe Commerce base URL and store code.
4. Configure the Redsys payment method from the Redsys configuration available in Adobe Commerce Admin.
5. Verify that the Out-of-Process Payment Methods endpoint is available.

The module uses Adobe Commerce Out-of-Process Payment Methods to expose the Redsys payment method to the storefront.

## PaaS / On-premises API requirements

The following REST functionality must be available:

```text
/rest/<store_code>/V1/oope_payment_method
```

The Redsys App uses the configured Commerce store code when constructing REST API paths.

The eventing API uses:

```text
/rest/all/V1/eventing/...
```

## Adobe Commerce Integration

For PaaS and on-premises deployments, an Adobe Commerce Integration with the permissions required by the Redsys App is required.

The Integration OAuth 1.0a credentials are managed through the Adobe Exchange application configuration and must not be entered into the Redsys payment configuration or exposed in the storefront.

## Supported deployments

This module supports:

* Adobe Commerce on Cloud (PaaS)
* Adobe Commerce on-premises

It is not required for:

* Adobe Commerce as a Cloud Service (SaaS)

## Related resources

* [Redsys Commerce App](https://github.com/seidor-cx/redsys-commerce)
* [Redsys EDS Payment Block](https://github.com/seidor-cx/redsys-eds-payment-block)
