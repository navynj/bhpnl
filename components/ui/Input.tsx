import * as React from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends React.ComponentProps<'input'> {
  error?: boolean | string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputMode, onChange, value, onBlur, error, ...props }, ref) => {
    const errorMessage = typeof error === 'string' ? error : error ? '' : undefined;
    const hasError = !!error;
    const [internalValue, setInternalValue] = React.useState<string>(
      value?.toString() || ''
    );
    const inputRef = React.useRef<HTMLInputElement>(null);
    const isComposingRef = React.useRef(false);

    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        const newValue = value.toString();
        // Only sync if input is not focused (user is not typing)
        if (
          !inputRef.current?.matches(':focus') &&
          newValue !== internalValue &&
          !isComposingRef.current
        ) {
          setInternalValue(newValue);
        }
      } else if (value === null || value === undefined) {
        if (!inputRef.current?.matches(':focus')) {
          setInternalValue('');
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <div className="w-full">
      <input
        ref={(node) => {
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
          inputRef.current = node;
        }}
        type={type === 'number' ? 'text' : type}
        inputMode={type === 'number' ? inputMode || 'decimal' : inputMode}
        value={internalValue}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        onChange={
          type === 'number'
            ? (e) => {
                const edited = { ...e };
                const inputValue = e.target.value;
                const leadingZero = /^(0+[1-9]+)$/;
                // Allow digits and at most one decimal point
                // Pattern matches: 0, 0., 0.5, 12, 12., 12.5, .5
                const float = /^\d*\.?\d*$/;

                if (inputValue === '') {
                  setInternalValue('');
                  onChange && onChange(e);
                  return;
                }

                // Check if more than one decimal point
                if ((inputValue.match(/\./g) || []).length > 1) {
                  return;
                }

                if (leadingZero.test(inputValue)) {
                  const normalizedValue = (+inputValue).toString();
                  edited.target.value = normalizedValue;
                  setInternalValue(normalizedValue);
                  onChange && onChange(edited);
                  return;
                } else if (!float.test(inputValue)) {
                  return;
                }

                setInternalValue(inputValue);
                onChange && onChange(e);
              }
            : (e) => {
                setInternalValue(e.target.value);
                onChange && onChange(e);
              }
        }
        onBlur={
          type === 'number'
            ? (e) => {
                const inputValue = e.target.value.trim();
                // If empty or only '.', set to 0
                if (inputValue === '' || inputValue === '.') {
                  setInternalValue('0');
                  const edited = {
                    ...e,
                    target: { ...e.target, value: '0' },
                  };
                  onChange && onChange(edited);
                } else {
                  // Normalize the value - remove trailing decimal point
                  const numValue = parseFloat(inputValue);
                  if (!isNaN(numValue)) {
                    const normalizedValue = numValue.toString();
                    if (normalizedValue !== inputValue) {
                      setInternalValue(normalizedValue);
                      const edited = {
                        ...e,
                        target: { ...e.target, value: normalizedValue },
                      };
                      onChange && onChange(edited);
                    }
                  }
                }
                // Call original onBlur if provided
                onBlur && onBlur(e);
              }
            : onBlur
        }
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          hasError && 'border-red-500 focus-visible:ring-red-500 placeholder:text-red-500 placeholder:opacity-50',
          className
        )}
        {...props}
      />
      {errorMessage && (
        <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
      )}
    </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
