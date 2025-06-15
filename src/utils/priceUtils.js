function applyDiscount(product) {
    let actualPrice = product.sellingPrice;
    let price = null;
    let discountBadge = null;

    if (product.discount && product.discount !== 0) {
        if (product.discountType === "percentage") {
            price = actualPrice;
            actualPrice = actualPrice - (actualPrice * product.discount / 100);
            discountBadge = `-${product.discount}% off`;
        } else if (product.discountType === "fixed") {
            price = actualPrice;
            actualPrice = actualPrice - product.discount;
            discountBadge = `-₹${product.discount} off`;
        }
    }

    return {
        ...product,
        actualPrice: actualPrice.toFixed(0),
        price: price ? price.toFixed(2) : null,
        discountBadge
    };
}

module.exports = {
    applyDiscount
};
