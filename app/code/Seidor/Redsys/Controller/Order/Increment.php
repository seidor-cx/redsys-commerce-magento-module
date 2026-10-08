<?php

namespace Seidor\Redsys\Controller\Order;

use Magento\Customer\Model\Session as CustomerSession;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Sales\Api\OrderRepositoryInterface;
use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;

class Increment extends Action
{
    private $resultJsonFactory;
    private $orderRepository;
    private $customerSession;

    public function __construct(
        Context $context,
        JsonFactory $resultJsonFactory,
        OrderRepositoryInterface $orderRepository,
        CustomerSession $customerSession
    ) {
        parent::__construct($context);
        $this->resultJsonFactory = $resultJsonFactory;
        $this->orderRepository = $orderRepository;
        $this->customerSession = $customerSession;
    }

    public function execute()
    {
        $result = $this->resultJsonFactory->create();

        $orderId = (int) $this->getRequest()->getParam('order_id');

        if (!$orderId) {
            return $result
                ->setHttpResponseCode(400)
                ->setData([
                    'success' => false,
                    'message' => 'Order ID is required'
                ]);
        }

        try {
            $order = $this->orderRepository->get($orderId);

            return $result->setData([
                'success' => true,
                'increment_id' => $order->getIncrementId()
            ]);
        } catch (\Throwable $e) {
            return $result
                ->setHttpResponseCode(500)
                ->setData([
                    'success' => false,
                    'message' => 'Unable to load order'
                ]);
        }
    }
}
