// Consultation requests are emailed through FormSubmit (formsubmit.co).
// After confirming the activation email, replace the address below with the
// random string FormSubmit sends you, so the email isn't visible in the page source.
const LEAD_ENDPOINT = "https://formsubmit.co/ajax/americancabinetryinc@gmail.com";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

(() => {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");

  // Mobile navigation
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });

  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });

  window.matchMedia("(min-width: 1200px)").addEventListener("change", (mq) => {
    if (mq.matches) setMenu(false);
  });

  // Header shadow once the page scrolls
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Reveal on scroll, staggered within a group
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    document.querySelectorAll(".reveal").forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      const index = siblings.indexOf(el);
      if (index > 0) el.style.transitionDelay = `${Math.min(index, 5) * 60}ms`;
      revealObserver.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  // Consultation form
  const form = document.querySelector("[data-contact-form]");
  if (form) {
    const summary = form.querySelector("[data-form-summary]");
    const success = form.querySelector("[data-form-success]");
    const failure = form.querySelector("[data-form-error]");
    const button = form.querySelector('button[type="submit"]');
    const buttonLabel = button.textContent;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Preselect from links like contact.html?type=builder#consultation or ?countertops=1
    const params = new URLSearchParams(window.location.search);
    const typeSelect = form.elements.customer_type;
    const type = params.get("type");
    if (type && [...typeSelect.options].some((o) => o.value === type)) typeSelect.value = type;
    if (params.get("countertops") === "1") form.elements.countertops.checked = true;

    const rules = {
      name: (f) => (f.value.trim() ? "" : "Please enter your name."),
      phone: (f) => {
        const digits = f.value.replace(/\D/g, "");
        if (!digits) return "Please enter a phone number so we can call you.";
        return digits.length >= 10 ? "" : "Enter a 10-digit phone number, like 720-555-0123.";
      },
      email: (f) => {
        if (!f.value.trim()) return "Please enter your email.";
        return emailPattern.test(f.value.trim()) ? "" : "Enter an email like name@example.com.";
      },
      upload: (f) => {
        const file = f.files[0];
        return file && file.size > MAX_UPLOAD_BYTES ? "That file is over 10 MB. Please choose a smaller photo or PDF." : "";
      },
    };

    const showError = (field, message) => {
      const error = form.querySelector(`#${field.id}-error`);
      field.setAttribute("aria-invalid", message ? "true" : "false");
      error.textContent = message;
      error.hidden = !message;
    };

    const validateField = (field) => {
      const message = rules[field.name](field);
      showError(field, message);
      return message;
    };

    Object.keys(rules).forEach((name) => {
      const field = form.elements[name];
      const event = field.type === "file" ? "change" : "blur";
      field.addEventListener(event, () => {
        if (field.value || field.getAttribute("aria-invalid") === "true") validateField(field);
      });
      field.addEventListener("input", () => {
        if (field.getAttribute("aria-invalid") === "true") validateField(field);
      });
    });

    const selectedText = (select) => (select.value ? select.selectedOptions[0].textContent.trim() : "");
    const checkedText = (name) => {
      const input = form.querySelector(`input[name="${name}"]:checked`);
      return input ? input.closest("label").textContent.trim() : "";
    };

    // Field names become the row labels in the email FormSubmit sends.
    const buildPayload = () => {
      const el = form.elements;
      const who = selectedText(el.customer_type);
      const data = new FormData();
      data.append("_subject", `New consultation request: ${el.name.value.trim()}${who ? ` (${who})` : ""}`);
      data.append("_template", "table");
      data.append("_replyto", el.email.value.trim());
      data.append("_honey", el._honey.value);
      data.append("Name", el.name.value.trim());
      data.append("Phone", el.phone.value.trim());
      data.append("Email", el.email.value.trim());
      data.append("I am a", who || "Not specified");
      data.append("Project type", selectedText(el.project_type) || "Not specified");
      data.append("Interested in", checkedText("level") || "Not specified");
      data.append("Material", checkedText("material") || "Not specified");
      data.append("Also needs countertops", el.countertops.checked ? "Yes" : "No");
      data.append("Timeline", selectedText(el.timeline) || "Not specified");
      data.append("City or zip", el.location.value.trim() || "Not specified");
      data.append("Message", el.message.value.trim() || "(none)");
      data.append("Sent from page", window.location.pathname);
      if (el.upload.files[0]) data.append("attachment", el.upload.files[0]);
      return data;
    };

    const sendLead = async (payload) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(LEAD_ENDPOINT, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: payload,
          signal: controller.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || String(body.success) !== "true") {
          throw new Error(body.message || `Request failed (${res.status})`);
        }
      } finally {
        clearTimeout(timer);
      }
    };

    const setSending = (sending) => {
      button.disabled = sending;
      button.setAttribute("aria-busy", String(sending));
      button.textContent = sending ? "Sending…" : buttonLabel;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      success.hidden = true;
      failure.hidden = true;

      const errors = Object.keys(rules)
        .map((name) => ({ field: form.elements[name], message: validateField(form.elements[name]) }))
        .filter((r) => r.message);

      if (errors.length) {
        summary.innerHTML = "";
        const heading = document.createElement("p");
        heading.textContent = errors.length === 1 ? "Please fix 1 field:" : `Please fix ${errors.length} fields:`;
        const list = document.createElement("ul");
        errors.forEach(({ field, message }) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = `#${field.id}`;
          a.textContent = message;
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            field.focus();
          });
          li.append(a);
          list.append(li);
        });
        summary.append(heading, list);
        summary.hidden = false;
        summary.focus();
        return;
      }

      summary.hidden = true;
      setSending(true);
      try {
        await sendLead(buildPayload());
        form.reset();
        success.hidden = false;
      } catch (err) {
        console.error("Consultation request failed:", err);
        failure.hidden = false;
      } finally {
        setSending(false);
      }
    });
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
