"use client"

import { Field as FieldPrimitive } from "@base-ui/react/field"
import { Form as FormPrimitive } from "@base-ui/react/form"
import { cn } from "cn"

// Форма без системних підказок браузера: Base UI вимикає нативну валідацію (noValidate) і показує FieldError
// нашим стилем під полем. Валідну форму відправляє як звичайну — server action у `action` працює без змін.
function Form({ className, ...props }: FormPrimitive.Props) {
  return <FormPrimitive data-slot="form" className={className} {...props} />
}

function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      role="alert"
      className={cn("text-sm text-destructive", className)}
      {...props}
    />
  )
}

export { Form, Field, FieldError }
