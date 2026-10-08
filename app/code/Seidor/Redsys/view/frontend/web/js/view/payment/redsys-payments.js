define([
    'uiComponent',
    'Magento_Checkout/js/model/payment/renderer-list'
], function (Component, rendererList) {
    'use strict';

    rendererList.push({
        type: 'redsys',
        component: 'Seidor_Redsys/js/view/payment/method-renderer/redsys'
    });

    return Component.extend({});
});
