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
        <label htmlFor={fieldId} className={`block text-sm font-medium mb-1 ${labelColor}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {childrenWithId}
      {hint && <p className={`text-xs ${hintColor}`}>{hint}</p>}
      {error && <p className={`text-xs ${errorColor} mt-1`}>{error}</p>}
    </div>
  );
};

FormField.displayName = "FormField";
