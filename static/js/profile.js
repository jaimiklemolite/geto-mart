fetch("/api/users/profile", {
  credentials: "include"
})
.then(res => {
  if (!res.ok) {
    window.location.href = "/";
    return null;
  }
  return res.json();
})
.then(data => {
  if (!data) return;

  const { user, orders } = data;
  const currentPlan = (data.membership?.plan || "free").toLowerCase();
  updateMembershipButtons(currentPlan);

  const profileInfo = document.getElementById("profileInfo");
  if (profileInfo) {

    let membershipHTML = "";
    if(user.role !== "admin"){
      membershipHTML = `
        <p><b>Membership:</b>
          <span id="membershipText">
            ${(data.membership?.plan || "free").toUpperCase()}
          </span>
        </p>

        ${
          data.membership?.purchased_at
          ? (() => {
              const purchased = new Date(data.membership.purchased_at);

              const formatted = purchased.toLocaleString("en-IN",{
                day:"2-digit",
                month:"short",
                year:"numeric"
              });

              return `<p class="membership-purchased">
                        <b>Purchased On:</b> ${formatted}
                      </p>`;
            })()
          : ""
        }

        ${
          data.membership?.expires_at
          ? (() => {
              const expiry = new Date(data.membership.expires_at);

              const formatted = expiry.toLocaleDateString("en-IN",{
                day:"2-digit",
                month:"short",
                year:"numeric"
              });

              const today = new Date();
              const diffTime = expiry - today;

              const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              return `<p class="membership-expiry">
                        <b>Valid Until:</b> ${formatted}
                      </p>
                      <p class="membership-remaining">
                        Remaining: ${remainingDays} days
                      </p>`;
          })()
          : ""
        }
      `;
    }

    profileInfo.innerHTML = `
        <p><b>Username:</b> ${titleCase(user.username || "-")}</p>
        <p><b>Email:</b> ${user.email}</p>
        ${membershipHTML}
    `;
  }

  if (user.role === "admin") return;

  const orderDiv = document.getElementById("orderHistory");
  if (!orderDiv) return;

  const recentOrders = (orders || [])
    .filter(o => ["Delivered", "Rejected", "Cancelled"].includes(o.status))
    .sort((a, b) => {
      if (a.status === "Delivered" && b.status === "Delivered") {
        return new Date(b.delivered_at || 0) - new Date(a.delivered_at || 0);
      }
      return new Date(b.status_updated_at || 0) - new Date(a.status_updated_at || 0);
    });

  if (!recentOrders.length) {
    orderDiv.innerHTML = "<p>No recent orders</p>";
    return;
  }

  orderDiv.innerHTML = recentOrders.map(order => `
    <div class="order-card">

      <div class="order-header">
        <span><b>Order ID:</b> ${order.order_number}</span>
        <span class="order-status ${order.status.toLowerCase().replace(/ /g, "-")}">
          ${order.status}
        </span>
      </div>

      <div class="order-summary-items">
        ${order.items.map(item => `
          <p>• ${item.name} × ${item.qty} (₹${(item.price_at_purchase ?? item.price ?? 0).toLocaleString("en-IN")})</p>
        `).join("")}
      </div>

      <p><strong>Total Items:</strong> ${order.total_items}</p>
      <p class="order-total" style="font-weight:500;color:#0f766e;">
        <strong>Order Total:</strong>
        ₹${order.order_total?.toLocaleString("en-IN") || 0}
      </p>
    </div>
  `).join("");
});

function updateMembershipButtons(currentPlan){
  const buttons = document.querySelectorAll(".membership-btn");
  buttons.forEach(btn => {

    const plan = btn.dataset.plan;
    const card = btn.closest(".membership-card");

    if(plan === currentPlan){
      btn.textContent = "Active";
      btn.disabled = true;
      btn.classList.add("membership-disabled");

      if(card){
        card.classList.add("membership-active");
      }
    }else{
      btn.textContent =
        "Buy " + plan.charAt(0).toUpperCase() + plan.slice(1);

      btn.disabled = false;
      btn.classList.remove("membership-disabled");

      if(card){
        card.classList.remove("membership-active");
      }
    }
  });
}

function buyMembership(plan){
  fetch("/api/membership/buy",{
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({plan})
  })
  .then(res=>res.json())
  .then(data=>{

    if(!data || data.error){
      showToast("Membership Purchase Failed","error");
      return;
    }
    showToast("Membership Activated Successfully","success");

    const membershipText = document.getElementById("membershipText");
    if(membershipText){
      membershipText.textContent = plan.toUpperCase();
    }

    if(data.expires_at){

      const expiry = new Date(data.expires_at);

      const formattedExpiry = expiry.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric"
      });

      const today = new Date();
      const diffTime = expiry - today;
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let expiryElement = document.querySelector(".membership-expiry");
      let remainingElement = document.querySelector(".membership-remaining");

      if(!expiryElement){

        expiryElement = document.createElement("p");
        expiryElement.className = "membership-expiry";
        membershipText.parentElement.insertAdjacentElement("afterend", expiryElement);
      }

      expiryElement.innerHTML = `<b>Valid Until:</b> ${formattedExpiry}`;

      if(!remainingElement){

        remainingElement = document.createElement("p");
        remainingElement.className = "membership-remaining";
        expiryElement.insertAdjacentElement("afterend", remainingElement);
      }

      remainingElement.innerHTML = `Remaining: ${remainingDays} days`;
    }

    if(data.purchased_at){

      const purchased = new Date(data.purchased_at);

      const formattedPurchased = purchased.toLocaleString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric"
      });

      let purchasedElement = document.querySelector(".membership-purchased");

      if(!purchasedElement){

        purchasedElement = document.createElement("p");
        purchasedElement.className = "membership-purchased";

        const expiryElement = document.querySelector(".membership-expiry");

        if(expiryElement){
          expiryElement.insertAdjacentElement("beforebegin", purchasedElement);
        }else{
          membershipText.parentElement.insertAdjacentElement("afterend", purchasedElement);
        }
      }
      purchasedElement.innerHTML = `<b>Purchased On:</b> ${formattedPurchased}`;
    }

    updateMembershipButtons(plan);
  })
  .catch(()=>{
    showToast("Membership Purchase Failed","error");
  });
}

function switchProfileTab(tabId, el) {
  document.querySelectorAll(".profile-tab")
    .forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".profile-section")
    .forEach(sec => sec.classList.remove("active"));
  el.classList.add("active");

  document.getElementById(tabId).classList.add("active");
}
