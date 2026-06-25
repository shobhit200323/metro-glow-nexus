import { useState, type FormEvent } from "react";

type Tab = "login" | "register";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("login");
  const [showPw, setShowPw] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onClose();
  }

  return (
    <div className="cream-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cream-card cream-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cream-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="cream-tabs">
          <button
            type="button"
            className={`cream-tab ${tab === "login" ? "is-active" : ""}`}
            onClick={() => setTab("login")}
          >
            STAFF LOGIN
          </button>
          <button
            type="button"
            className={`cream-tab ${tab === "register" ? "is-active" : ""}`}
            onClick={() => setTab("register")}
          >
            REGISTER
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {tab === "register" && (
            <div className="cream-field">
              <input className="cream-input" placeholder="Full Name" />
            </div>
          )}
          <div className="cream-field">
            <input className="cream-input" placeholder="Emp ID" style={{ textTransform: "uppercase" }} />
          </div>
          {tab === "register" && (
            <div className="cream-field">
              <input className="cream-input" placeholder="Access Code" type="password" />
            </div>
          )}
          <div className="cream-field cream-field-pw">
            <input
              className="cream-input"
              placeholder={tab === "register" ? "Create Password" : "Password"}
              type={showPw ? "text" : "password"}
            />
            <button
              type="button"
              className="cream-pw-toggle"
              onClick={() => setShowPw((v) => !v)}
              aria-label="Toggle password visibility"
            >
              👁️
            </button>
          </div>
          {tab === "register" && (
            <div className="cream-field">
              <input className="cream-input" placeholder="Confirm Password" type="password" />
            </div>
          )}
          <button type="submit" className="cream-btn cream-btn-primary cream-btn-block">
            {tab === "login" ? "LOGIN" : "REGISTER"}
          </button>
        </form>
      </div>
    </div>
  );
}