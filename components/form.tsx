import type {
  BrevoProps,
  FieldData,
  FieldProps,
  FormData,
  FormProps,
  OptionProps,
} from "@props/types";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerHeader,
  DrawerFooter,
  Spinner,
  Checkbox,
  Link,
  Alert,
} from "@heroui/react";
import { opendays, Opendays } from "@pages/[...slug]";
import { StoryblokComponent } from "@storyblok/react";
import { fieldValidation } from "@modules/validations";
import { getCapitalize } from "@modules/formats";
import { useState, useEffect, useMemo, useCallback } from "react";
import { compiler } from "markdown-to-jsx";
import { Typography } from "./typography";
import { tv } from "tailwind-variants";
import { sendGTMEvent } from "@next/third-parties/google";

const dateFormat = {
  year: "numeric" as const,
  month: "2-digit" as const,
  day: "2-digit" as const,
};

interface FormComponent {
  blok: FormProps;
  courses?: Array<OptionProps>;
  openday?: FieldData;
  variant?: "solid" | "ghost";
}

type FormStates = "close" | "open" | "search" | "send" | "error" | "done";

// Helper: Validate all fields immutably
function validateFields(data: FormData) {
  const updated = { ...data };
  Object.entries(updated).forEach(([name, field]) => {
    updated[name] = { ...field, error: fieldValidation(field) };
  });
  return updated;
}

// Helper: Build event object
function buildEvent(data: FormData, tracking: string) {
  const eventFilterData = [
    "email",
    "nome",
    "cognome",
    "sms",
    "newsletter",
    "validation",
  ];
  const properties: { [key: string]: Date | string } = {};
  const today = new Date();
  Object.entries(data)
    .filter(([name]) => !eventFilterData.includes(name))
    .map(([name, { value }]) => {
      let dateValue = new Date(value);
      if (typeof value === "number") {
        value = value;
      } else if (Array.isArray(value)) {
        if (name === "area") {
          const opendayList = opendays[value[0] as keyof Opendays];
          const event = opendayList.find(
            (event) => new Date(event.date) >= today
          );
          if (event?.date) {
            properties["openday_data"] = new Date(
              event.date
            ).toLocaleDateString("IT-it", dateFormat);
          }
        }
        value = value.join(", ");
      } else if (dateValue instanceof Date && !isNaN(dateValue.valueOf())) {
        value = dateValue;
        properties[name + "_data"] = dateValue.toLocaleDateString(
          "IT-it",
          dateFormat
        );
      }
      return (properties[name] = value);
    });

  return {
    identifiers: { email_id: data.email.value },
    event_name: `submit_${tracking}`,
    event_properties: properties,
  };
}

// Helper: Build contact object
function buildContact(data: FormData, user: BrevoProps | null, list: any) {
  const contactFilterData = ["email"];
  return {
    id: user?.id,
    email: data.email.value,
    listIds: list,
    attributes: Object.fromEntries(
      Object.entries(data)
        .filter(([name]) => !contactFilterData.includes(name))
        .map(([name, { value }]) => {
          const NAME = name.toUpperCase();
          if (!!user && typeof user.attributes[NAME] !== "undefined") {
            let attribube = user.attributes[NAME];
            if (Array.isArray(attribube)) {
              value = [...new Set([...attribube, ...value])];
            }
          }
          if (name === "sms") value = "+39" + value;
          return [NAME, value];
        })
    ),
  };
}

function mergeForm(blok: FormProps, courses?: Array<OptionProps>): FormProps {
  const alias = blok.alias?.content;
  if (!alias) return blok;

  // Merge lists and fields without mutation
  const mergedList = Array.from(new Set([...blok.list, ...alias.list]));
  let mergedFields = Array.from(new Set([...alias.fields, ...blok.fields]));

  // Handle enroll field
  const enrollIndex = mergedFields.findIndex(
    (field: FieldProps) => field.input === "enroll"
  );
  if (enrollIndex >= 0) {
    if (courses?.length) {
      mergedFields = mergedFields.map((field, idx) =>
        idx === enrollIndex ? { ...field, options: courses } : field
      );
    } else {
      mergedFields = mergedFields.filter((_, idx) => idx !== enrollIndex);
    }
  }

  return {
    ...blok,
    ...alias,
    list: mergedList,
    fields: mergedFields,
    title: alias.title || blok.title,
    label: alias.label || blok.label,
    message: [alias.message, blok.message].filter(Boolean).join("\n"),
    tracking: alias.tracking || blok.tracking,
    terms: alias.terms || blok.terms,
  };
}

export default function Form({
  blok,
  courses,
  openday,
  variant,
}: FormComponent) {
  // Merge alias to root form
  const form = useMemo(
    () => mergeForm(blok, courses),
    [blok, blok.alias, courses]
  );

  useEffect(() => {
    if (openday) {
      setData({ ...data, openday });
    }
  }, [openday]);

  // Init Data
  const [data, setData] = useState(() => getData(form.fields));
  const [user, setUser] = useState<BrevoProps | null>(null);
  const [agreement, setAgreement] = useState(!form.terms);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormStates>("close");
  const [message, setMessage] = useState<{
    title: string;
    body: string;
  } | null>(null);

  // Only render visible fields
  const visibleFields = useMemo(
    () => form.fields.filter((f) => !f.hidden),
    [form.fields]
  );

  const handleChange = (field: FieldData) => {
    field.error = fieldValidation(field);
    if (field.id === "nome" || field.id === "cognome") {
      field.value = getCapitalize(field.value);
    }
    setData({ ...data, [field.id]: field });
  };

  const handleUser = async (field: FieldData) => {
    if (!field.error) {
      setState("search");
      const response = await fetch("/api/send-brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: { email: field.value } }),
      });

      const responseUser = response.ok ? await response.json() : null;
      await setUser(responseUser);

      // Create a new data object immutably
      const newData = { ...data };
      newData.email = {
        ...newData.email,
        value: responseUser?.email || field.value,
        error: field.error,
      };
      newData.nome = {
        ...newData.nome,
        value: responseUser?.attributes?.NOME || "",
      };
      newData.cognome = {
        ...newData.cognome,
        value: responseUser?.attributes?.COGNOME || "",
      };
      newData.sms = {
        ...newData.sms,
        value: responseUser?.attributes?.SMS
          ? responseUser.attributes.SMS.toString().substring(2)
          : "",
      };

      await setData(newData);
      setState("open");
    }
  };

  const handleSubmit = async () => {
    const newData = validateFields(data);
    const hasError = Object.values(newData).some((f) => !!f.error);
    if (!hasError) {
      setState(!agreement ? "error" : "open");
      setError(!agreement ? errors.agreement : null);
      if (!agreement) return;

      setState("send");
      debugger;
      const event = buildEvent(newData, form.tracking);
      console.log(event);
      const contact = buildContact(newData, user, form.list);
      const response = await fetch("/api/send-brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, event }),
      });
      if (response.ok) {
        setMessage({
          title: parseText(titles[user ? "user" : "new"], data),
          body: parseText(form.message, data),
        });
        setState("done");
        return sendGTMEvent({ event: `submit_${form.tracking}_form` });
      } else {
        setState("error");
        return setError(errors.default);
      }
    } else {
      setState("error");
      setData(newData);
    }
  };

  const handleClear = () => {
    setUser(null);
    const newData = getData(form.fields);
    if (openday) {
      newData.openday = openday;
    }
    setData(newData);
  };

  const handleReset = () => {
    handleClear();
    setMessage(null);
    setError(null);
    setAgreement(!form.terms);
    setState("close");
  };

  // Utilities
  const parseText = useCallback(
    (text: string, data: FormData) => {
      const keys = text.match(/{{(.*?)}}/g);
      if (keys && !!keys.length) {
        keys.forEach((string) => {
          const key = string.replace("{{", "").replace("}}", "");
          if (!data[key]?.value) return text;
          let value = data[key].value;
          if (!Number.isNaN(new Date(value).valueOf())) {
            value = new Date(value).toLocaleDateString("it-IT");
          }
          text = text.replace(string, value);
        });
      }
      return text;
    },
    [data]
  );

  const { button, close, spinner, label, clear } = classes();

  const hiddenUserFields = ["nome", "cognome", "sms", "email"];

  return (
    <>
      <Button
        size="md"
        color="primary"
        variant={variant || "solid"}
        className={button()}
        onPress={() => setState("open")}
      >
        {form.label || "Compila il modulo"}
      </Button>
      <Drawer
        size="lg"
        isOpen={state !== "close"}
        onOpenChange={handleReset}
        classNames={{ closeButton: close() }}
      >
        <DrawerContent>
          <DrawerHeader>{form.title || "Titolo del modulo"}</DrawerHeader>
          <DrawerBody className="relative">
            {(state === "search" || state === "send") && (
              <div className={spinner()}>
                <Spinner
                  label={
                    state === "search" ? "Ricerca contatto" : "Invio modulo"
                  }
                  classNames={{ label: label() }}
                />
              </div>
            )}
            {state !== "done" && user && (
              <div className="mb-4">
                <h4 className="font-semibold text-xl capitalize">
                  Bentornato {user.attributes.NOME?.toString()}{" "}
                  {user.attributes.COGNOME?.toString()}!
                </h4>
                <p>
                  Abbiamo recuperato i tuoi dati, se vuoi cambiarli consulta
                  l'email di benvenuto.
                </p>
                <span className={clear()} onClick={() => handleClear()}>
                  Non sono io
                </span>
              </div>
            )}
            {state === "done" &&
              compiler(message?.title, {
                wrapper: null,
                overrides: Typography({}),
              })}
            {state !== "done" &&
              visibleFields.map((field, index) => {
                if (user && hiddenUserFields.includes(field.id)) return null;
                return (
                  <StoryblokComponent
                    blok={field}
                    data={data[field.id]}
                    onChange={handleChange}
                    onBlur={handleUser}
                    key={index}
                  />
                );
              })}
            {state !== "done" && form.terms && (
              <p className="mt-2">
                <Checkbox
                  isRequired={true}
                  onValueChange={(value) => {
                    setAgreement(value);
                    setError(!value ? errors.agreement : null);
                    setState(!value ? "error" : "open");
                  }}
                >
                  <p className="text-sm">Dichiaro di aver letto</p>
                </Checkbox>
                <Link
                  href={form.terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 underline underline-offset-1 text-sm"
                >
                  l' informativa Privacy
                </Link>
                .
              </p>
            )}
            {state === "done" &&
              compiler(message?.body, {
                wrapper: null,
                overrides: Typography({}),
              })}
            {state === "error" && !!error && (
              <div className="w-full flex items-center">
                <Alert color="danger" hideIcon variant="faded" title={error} />
              </div>
            )}
          </DrawerBody>
          <DrawerFooter className="justify-start">
            {state !== "done" && (
              <>
                <Button
                  color="primary"
                  onPress={handleSubmit}
                  isDisabled={state === "error"}
                >
                  Invia
                </Button>
                <Button color="default" onPress={handleReset}>
                  Annulla
                </Button>
              </>
            )}
            {state === "done" && (
              <Button color="primary" onPress={handleReset}>
                Chiudi
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

const getData = (fields: Array<FieldProps>) => {
  const data: FormData = {};
  fields.forEach(
    ({ id, input, placeholder = "", required, hidden: isHidden }) => {
      let value;
      if (isHidden) {
        // Always use placeholder for hidden fields
        value =
          input === "select" || input === "multiple" || input === "enroll"
            ? placeholder
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : placeholder;
      } else {
        switch (input) {
          case "checkbox":
            value = !!placeholder;
            break;
          case "enroll":
          case "select":
          case "multiple":
            value = [];
            break;
          default:
            value = "";
            break;
        }
      }
      data[id] = {
        id,
        value,
        required,
        error: null,
      };
    }
  );
  return data;
};

const titles = {
  new: "###Benvenuto {{nome}}!",
  user: "###Bentornato {{nome}}!\nAbbiamo recuperato i tuoi dati.",
  done: "###Grazie {{nome}}!",
};

const errors = {
  default: "Si è verificato un errore, riprova più tardi",
  agreement: "Devi accettare l’informativa privacy per procedere",
};

const classes = tv({
  slots: {
    button:
      "font-medium text-medium col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3",
    close: "text-xl hover:bg-transparent active:bg-transparent",
    spinner:
      "absolute inset-0 flex items-center justify-center z-20 bg-opacity-30 bg-background backdrop-blur-sm",
    label: "text-neutral-500",
    clear: "font-medium underline text-sm cursor-pointer text-primary",
  },
});
