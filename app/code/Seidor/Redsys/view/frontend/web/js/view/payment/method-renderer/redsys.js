define([
    'jquery',
    'ko',
    'Magento_Checkout/js/view/payment/default',
    'Magento_Checkout/js/model/quote'
], function ($, ko, Component, quote) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Seidor_Redsys/payment/redsys',
            redirectAfterPlaceOrder: false
        },
        idOper: null,
        redsysMessageListenerRegistered: false,
        paymentFlow: ko.observable('redirect'),
        insiteOrder: null,
        insiteConfig: null,
        oopePaymentMethodConfig: null,
        oopeConfigPromise: null,
        redsysLoadingPromise: null,

        loadRedsysJs: function (environment) {
            var self = this;

            if (this.redsysLoadingPromise) {
                return this.redsysLoadingPromise;
            }

            if (
                window.getInSiteForm &&
                window.storeIdOper
            ) {
                return $.Deferred()
                    .resolve()
                    .promise();
            }

            var url = environment === 'production'
                ? 'https://sis.redsys.es/sis/NC/redsysV3.js'
                : 'https://sis-t.redsys.es:25443/sis/NC/sandbox/redsysV3.js';

            this.redsysLoadingPromise = $.Deferred();

            var script = document.createElement('script');

            script.src = url;

            script.onload = function () {
                self.redsysLoadingPromise.resolve();
            };

            script.onerror = function () {
                self.redsysLoadingPromise.reject();
            };

            document.head.appendChild(script);

            return this.redsysLoadingPromise.promise();
        },

        initialize: function () {
            this._super();

            // Load OOPE configuration while the cart is still active.
            this.loadOopePaymentConfig();

            return this;
        },

        getCode: function () {
            return 'redsys';
        },

        getData: function () {
            return {
                method: this.item.method,
                additional_data: {}
            };
        },

        isInSite: function () {
            return this.paymentFlow() === 'insite';
        },

        selectPaymentMethod: function () {
            this._super();

            this.initializePaymentFlow();

            return true;
        },

        initializePaymentFlow: function () {
            var self = this;

            this.loadOopePaymentConfig()
                .done(function () {
                    var config = self.parsePaymentConfig(
                        self.oopePaymentMethodConfig
                    );

                    if (!config) {
                        return;
                    }

                    $.ajax({
                        url: config.baseUrl +
                            '/api/v1/web/redsys-commerce/init-params',
                        type: 'GET',
                        dataType: 'json'
                    }).done(function (init) {
                        self.insiteConfig = init;
                        self.paymentFlow(init.paymentFlow);
                        if (self.isInSite()) {
                            self.mountInSiteForm();
                        }
                    }).fail(function (xhr) {
                        console.error(
                            'Unable to load Redsys init params',
                            xhr
                        );
                    });
                });
        },

        mountInSiteForm: function () {
            var self = this;

            if (!this.insiteConfig) {
                console.error(
                    'Redsys InSite configuration not available'
                );
                return;
            }

            this.loadRedsysJs(
                this.insiteConfig.environment
            ).done(function () {

                if (!self.redsysMessageListenerRegistered) {
                    window.addEventListener('message', function (event) {
                        if (!event.origin.startsWith('https://sis')) {
                            return;
                        }

                        window.storeIdOper(
                            event,
                            'token',
                            'errorCode',
                            function () {
                                return true;
                            }
                        );

                        self.idOper = document.getElementById('token')?.value;
                    });

                    self.redsysMessageListenerRegistered = true;
                }

                var container = document.getElementById('card-form');

                if (!container) {
                    console.error(
                        'Redsys InSite container not found'
                    );
                    return;
                }

                container.innerHTML = '';

                self.insiteOrder =
                    Date.now().toString().slice(-12);

                window.getInSiteForm(
                    'card-form',
                    '',
                    '',
                    '',
                    '',
                    'Pagar con Redsys',
                    self.insiteConfig.merchantCode,
                    self.insiteConfig.terminal,
                    self.insiteOrder,
                    'ES',
                    true,
                    false,
                    'inline',
                    true
                );

                setTimeout(function () {
                    var iframe = document.querySelector(
                        '#card-form iframe'
                    );

                    if (iframe) {
                        iframe.contentWindow.postMessage(
                            'domain',
                            self.getRedsysOrigin(
                                self.insiteConfig.environment
                            )
                        );
                    }
                }, 500);
            }).fail(function () {
                console.error(
                    'Unable to load Redsys InSite JS'
                );
            });
        },
        showPaymentError: function (message) {
            var container = document.getElementById(
                'redsys-payment-error'
            );

            if (container) {
                container.textContent = message ||
                    'An error occurred with Redsys. Please try again.';
                container.style.display = 'block';
            }
        },
        handleRedsysPayment: function () {
            var self = this;

            var error = document.getElementById(
                'errorCode'
            )?.value;

            if (error) {
                console.error(
                    'Redsys token error',
                    error
                );

                self.showPaymentError();

                return $.Deferred()
                    .resolve(false)
                    .promise();
            }

            if (!self.idOper) {
                var iframe = document.querySelector(
                    '#card-form iframe'
                );

                if (!iframe) {
                    console.error(
                        'Redsys iframe not found'
                    );

                    return $.Deferred()
                        .resolve(false)
                        .promise();
                }

                iframe.contentWindow.postMessage(
                    {
                        payFromModule: true,
                        validation: 'OK'
                    },
                    self.getRedsysOrigin(
                        self.insiteConfig.environment
                    )
                );

                var deferred = $.Deferred();

                var interval = setInterval(function () {
                    var token = document.getElementById(
                        'token'
                    )?.value;

                    var errorCode = document.getElementById(
                        'errorCode'
                    )?.value;

                    if (errorCode) {
                        clearInterval(interval);

                        console.error(
                            'Redsys token error',
                            errorCode
                        );

                        self.showPaymentError();

                        deferred.resolve(false);

                        return;
                    }

                    if (!token) {
                        return;
                    }

                    clearInterval(interval);

                    self.idOper = token;

                    self.processInSitePayment()
                        .done(function () {
                            deferred.resolve(true);
                        })
                        .fail(function () {
                            deferred.resolve(false);
                        });
                }, 100);

                return deferred.promise();
            }

            return this.processInSitePayment();
        },

        getRedsysOrigin: function (environment) {
            return environment === 'production'
                ? 'https://sis.redsys.es'
                : 'https://sis-t.redsys.es:25443';
        },

        processInSitePayment: function () {
            var self = this;
            var config = this.parsePaymentConfig(
                this.oopePaymentMethodConfig
            );

            if (!config) {
                return $.Deferred()
                    .reject()
                    .promise();
            }

            return $.ajax({
                url: config.baseUrl +
                    '/api/v1/web/redsys-commerce/payment-insite',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    merchantOrder: self.insiteOrder,
                    amount: self.getGrandTotal(),
                    idOper: self.idOper
                })
            }).then(function (response) {

                if (!response.success) {
                    self.showPaymentError(
                        response.message ||
                        'An error occurred with Redsys. Please try again.'
                    );

                    throw new Error(
                        'Redsys InSite payment rejected'
                    );
                }

                return response;

            }).catch(function (xhr) {

                var message =
                    'An error occurred with Redsys. Please try again.';

                if (
                    xhr &&
                    xhr.responseJSON &&
                    xhr.responseJSON.message
                ) {
                    message = xhr.responseJSON.message;
                }

                self.showPaymentError(message);

                throw xhr;
            });
        },

        placeOrder: function (data, event) {
            var self = this;

            if (event) {
                event.preventDefault();
            }

            if (this.validate() && !this.isPlaceOrderActionAllowed()) {
                return false;
            }

            this.isPlaceOrderActionAllowed(false);

            if (this.isInSite()) {
                this.handleRedsysPayment()
                    .done(function (success) {
                        if (!success) {
                            self.isPlaceOrderActionAllowed(true);
                            return;
                        }

                        self.getPlaceOrderDeferredObject()
                            .done(function () {
                                // Magento crea el pedido
                            })
                            .fail(function (error) {
                                console.error(
                                    'Unable to place Magento order',
                                    error
                                );

                                self.isPlaceOrderActionAllowed(true);
                            });
                    })
                    .fail(function (error) {
                        console.error(
                            'Redsys InSite payment failed',
                            error
                        );

                        self.isPlaceOrderActionAllowed(true);
                    });

                return true;
            }

            this.loadOopePaymentConfig()
                .done(function () {
                    self.getPlaceOrderDeferredObject()
                        .done(function (orderId) {
                            self.getOrderIncrementId(orderId)
                                .done(function (incrementId) {
                                    self.startRedsysPayment(
                                        incrementId
                                    );
                                })
                                .fail(function (error) {
                                    console.error(
                                        'Unable to get Magento order increment ID',
                                        error
                                    );

                                    self.isPlaceOrderActionAllowed(true);
                                });
                        })
                        .fail(function () {
                            self.isPlaceOrderActionAllowed(true);
                        });
                })
                .fail(function (error) {
                    console.error(
                        'Unable to load Redsys OOPE configuration',
                        error
                    );

                    self.isPlaceOrderActionAllowed(true);
                });

            return true;
        },

        getOrderIncrementId: function (orderId) {
            return $.ajax({
                url: '/redsys/order/increment',
                type: 'GET',
                dataType: 'json',
                data: {
                    order_id: orderId
                }
            }).then(function (response) {
                if (!response.success || !response.increment_id) {
                    throw new Error(
                        response.message || 'Unable to get order increment ID'
                    );
                }

                return response.increment_id;
            });
        },

        startRedsysPayment: function (orderId) {
            var self = this;
            var config = this.parsePaymentConfig(
                this.oopePaymentMethodConfig
            );

            if (!config) {
                console.error('Redsys configuration not found');
                self.isPlaceOrderActionAllowed(true);
                return;
            }

            $.ajax({
                url: config.baseUrl +
                    '/api/v1/web/redsys-commerce/init-params',
                type: 'GET',
                dataType: 'json'
            }).done(function (init) {
                self.createRedsysPayment(
                    orderId,
                    init,
                    config
                );
            }).fail(function (xhr) {
                console.error(
                    'Unable to load Redsys configuration',
                    xhr
                );
                self.isPlaceOrderActionAllowed(true);
            });
        },

        loadOopePaymentConfig: function () {
            var self = this;

            if (this.oopeConfigPromise) {
                return this.oopeConfigPromise;
            }

            var cartId = window.checkoutConfig.quoteId;

            if (!cartId) {
                this.oopeConfigPromise = $.Deferred()
                    .reject('Magento quote ID not available')
                    .promise();

                return this.oopeConfigPromise;
            }

            var query = `
query {
    cart(cart_id: "${cartId}") {
        available_payment_methods {
            code
            title
            oope_payment_method_config {
                backend_integration_url
                custom_config {
                    key
                    value
                }
            }
        }
    }
}
`;

            this.oopeConfigPromise = $.ajax({
                url: '/graphql',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    query: query
                })
            }).then(function (response) {
                if (
                    response.errors &&
                    response.errors.length
                ) {
                    throw response.errors;
                }

                var methods =
                    response.data &&
                    response.data.cart &&
                    response.data.cart.available_payment_methods;

                if (!methods) {
                    throw new Error(
                        'No payment methods returned by GraphQL'
                    );
                }

                var redsys = methods.find(function (method) {
                    return method.code === 'redsys';
                });

                if (
                    !redsys ||
                    !redsys.oope_payment_method_config
                ) {
                    throw new Error(
                        'Redsys OOPE configuration not found'
                    );
                }

                self.oopePaymentMethodConfig =
                    redsys.oope_payment_method_config;
                return self.oopePaymentMethodConfig;
            });

            return this.oopeConfigPromise;
        },

        parsePaymentConfig: function (oopeConfig) {
            if (
                !oopeConfig ||
                !oopeConfig.backend_integration_url
            ) {
                console.error(
                    'Redsys backend integration URL not found'
                );
                return null;
            }

            try {
                return JSON.parse(
                    oopeConfig.backend_integration_url
                );
            } catch (e) {
                console.error(
                    'Invalid Redsys backend configuration',
                    e
                );
                return null;
            }
        },

        createRedsysPayment: function (orderId, init, config) {
            var self = this;

            $.ajax({
                url: config.baseUrl +
                    '/api/v1/web/redsys-commerce/payment',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    orderId: orderId,
                    amount: self.getGrandTotal(),
                    urlOk: window.location.origin +
                        '/checkout/onepage/success/',
                    urlKo: window.location.origin +
                        '/checkout/onepage/failure/',
                    callbackUrl: config.baseUrl +
                        '/api/v1/web/redsys-commerce/webhook'
                })
            }).done(function (response) {
                if (!response.url || !response.params) {
                    console.error(
                        'Invalid Redsys response',
                        response
                    );
                    self.isPlaceOrderActionAllowed(true);
                    return;
                }

                self.submitRedsysForm(
                    response.url,
                    response.params
                );
            }).fail(function (xhr) {
                console.error(
                    'Unable to create Redsys payment',
                    xhr
                );
                self.isPlaceOrderActionAllowed(true);
            });
        },

        getGrandTotal: function () {
            var totals = quote.totals();

            if (
                !totals ||
                typeof totals.grand_total === 'undefined'
            ) {
                throw new Error(
                    'Magento checkout total not available'
                );
            }

            return parseFloat(totals.grand_total);
        },

        submitRedsysForm: function (action, params) {
            var form = document.createElement('form');

            form.method = 'POST';
            form.action = action;

            Object.keys(params).forEach(function (key) {
                var input = document.createElement('input');

                input.type = 'hidden';
                input.name = key;
                input.value = params[key];

                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
        }
    });
});
