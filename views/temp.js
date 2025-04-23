$(document).ready(function(){
	$('.checkout-form').submit(function(e){
		e.preventDefault();

		var formData = $(this).serialize();

		$.ajax({
			url: "/checkout/payment", // Specify the route here
			type: "POST",
			data: formData,
			success: function(res){
                console.log("1st check")
				if (res.success) {
                    console.log("2nd check")
					var options = {
						"key": res.key_id,
						"amount": res.amount,
						"currency": "INR",
						"name": "SHiLPP",
						"order_id": res.order_id,
						"handler": function (response){
							alert("Payment Succeeded");
							window.location.href = "/orderSuccess";
						},
						"prefill": {
							"contact": res.contact,
							"name": res.name,
							"email": res.email
						},
						"notes": {
							"description": "Transaction"
						},
						"theme": {
							"color": "#2300a3"
						}
					};

					var razorpayObject = new Razorpay(options);
					razorpayObject.on('payment.failed', function (response){
						alert("Payment Failed. Reason: " + response.error.description);
					});
					razorpayObject.open();
				} else {
					alert(res.msg || "Error creating order. Please try again.");
				}
			},
			error: function(err){
				alert("Failed to create order. Please check your internet connection.");
			}
		});
	});
});
