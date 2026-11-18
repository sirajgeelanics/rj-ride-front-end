import React, { useId } from "react";

interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  dark?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, hint, required, children, dark = false }) => {
  const fieldId = useId();
  const labelColor = dark ? "text-white" : "text-text-primary";
  const hintColor = dark ? "text-white/80" : "text-text-secondary";
  const errorColor = dark ? "text-danger" : "text-danger";

  // Inject the generated field ID into child form controls
  // so the label's htmlFor matches the input/select id
  const childrenWithId = React.Children.map(children, (child) => {
    if (React.isValidElement<{ id?: string }>(child)) {
      return React.cloneElement(child, { id: fieldId });
    }
    return child;
  });

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className={`block text-xs font-semibold mb-1.5 ${labelColor}`}>
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {childrenWithId}
      {hint && <p className={`text-xs mt-1.5 ${hintColor}`}>{hint}</p>}
      {error && <p className={`text-xs ${errorColor} mt-1.5`} role="alert">{error}</p>}
    </div>
  );
};

FormField.displayName = "FormField";
