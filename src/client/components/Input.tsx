import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import "./Input.css";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
