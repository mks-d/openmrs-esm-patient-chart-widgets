import React, { useEffect, useRef, useState } from "react";
import SummaryCard from "../../ui-components/cards/summary-card.component";
import styles from "./immunizations-form.css";
import { DataCaptureComponentProps } from "../shared-utils";
import { useTranslation } from "react-i18next";
import { savePatientImmunization } from "./immunizations.resource";
import { mapToFHIRImmunizationResource } from "./immunization-mapper";
import { useCurrentPatient } from "@openmrs/esm-api";
import { useHistory } from "react-router-dom";
import { createErrorHandler } from "@openmrs/esm-error-handling";
import { getStartedVisit } from "../visit/visit-utils";
import useSessionUser from "../../utils/use-session-user";
import {
  ImmunizationFormData,
  ImmunizationSequence
} from "./immunization-domain";

export function ImmunizationsForm(props: ImmunizationsFormProps) {
  const initialState: ImmunizationFormState = {
    vaccineName: "",
    vaccineUuid: "",
    immunizationObsUuid: "",
    vaccinationDate: null,
    sequences: [],
    currentDose: {} as ImmunizationSequence,
    expirationDate: null,
    lotNumber: "",
    manufacturer: "",
    formChanged: false
  };
  const [formState, setFormState] = useState(initialState);
  const updateSingle = <T extends keyof ImmunizationFormState>(
    name: T,
    value: typeof formState[T]
  ) => setFormState(state => ({ ...state, [name]: value }));

  const [
    isLoadingPatient,
    patient,
    patientUuid,
    patientErr
  ] = useCurrentPatient();
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useTranslation();
  const history = useHistory();
  const today = new Date().toISOString().split("T")[0];
  const currentUser = useSessionUser();

  const isViewEditMode = !!formState.immunizationObsUuid;
  const enableCreateButtons = !isViewEditMode && !!formState.vaccinationDate;
  const enableEditButtons = isViewEditMode && formState.formChanged;

  useEffect(() => {
    if (props.match.params) {
      const {
        immunizationObsUuid,
        vaccineName,
        vaccineUuid,
        manufacturer,
        expirationDate,
        vaccinationDate,
        lotNumber,
        sequences,
        currentDose
      }: ImmunizationFormData = props.match.params;

      const formStateFromParam: ImmunizationFormState = {
        immunizationObsUuid,
        vaccineName,
        vaccineUuid,
        manufacturer,
        lotNumber,
        expirationDate,
        vaccinationDate,
        formChanged: false,
        sequences: hasSequences(sequences) ? sequences : [],
        currentDose: currentDose || ({} as ImmunizationSequence)
      };
      setFormState(formStateFromParam);
    }
  }, [props.match.params]);

  const handleFormSubmit = event => {
    event.preventDefault();
    const currentVisitUuid = getStartedVisit?.getValue()?.visitData?.uuid;
    const currentLocationUuid = currentUser?.sessionLocation?.uuid;
    const currentProviderUuid = currentUser?.currentProvider?.uuid;

    const immunization: ImmunizationFormData = {
      patientUuid,
      immunizationObsUuid: formState.immunizationObsUuid,
      vaccineName: formState.vaccineName,
      vaccineUuid: formState.vaccineUuid,
      manufacturer: formState.manufacturer,
      expirationDate: formState.expirationDate,
      vaccinationDate: formState.vaccinationDate,
      lotNumber: formState.lotNumber,
      currentDose: formState.currentDose
    };
    const abortController = new AbortController();

    savePatientImmunization(
      mapToFHIRImmunizationResource(
        immunization,
        currentVisitUuid,
        currentLocationUuid,
        currentProviderUuid
      ),
      patientUuid,
      formState.immunizationObsUuid,
      abortController
    ).then(response => {
      response.status === 200 && navigate();
    }, createErrorHandler);
    return () => abortController.abort();
  };

  function navigate() {
    history.push(`/patient/${patientUuid}/chart/immunizations`);
    props.closeComponent();
  }

  function isNumber(value) {
    return !isNaN(value);
  }

  const onDoseSelect = event => {
    const defaultDose = {} as ImmunizationSequence;
    const currentDose: ImmunizationSequence =
      formState.sequences.find(
        s =>
          isNumber(event.target.value) &&
          s.sequenceNumber === parseInt(event.target.value)
      ) || defaultDose;
    updateSingle("currentDose", currentDose);
  };

  function createForm() {
    const addVaccineDefaultFormat = "Add Vaccine: {vaccineName}";
    const editVaccineDefaultFormat = "Edit Vaccine: {vaccineName}";
    const addFormHeader = t("add vaccine format", addVaccineDefaultFormat, {
      vaccineName: formState.vaccineName
    });
    const editFormHeader = t("edit vaccine format", editVaccineDefaultFormat, {
      vaccineName: formState.vaccineName
    });

    return (
      <form
        onSubmit={handleFormSubmit}
        data-testid="immunization-form"
        onChange={() => {
          updateSingle("formChanged", true);
          return props.entryStarted();
        }}
        className={styles.immunizationsForm}
        ref={formRef}
      >
        <SummaryCard
          name={isViewEditMode ? editFormHeader : addFormHeader}
          className={styles.immunizationsFormSummaryCard}
        >
          <div className={styles.immunizationsContainerWrapper}>
            <div style={{ flex: 1, margin: "0rem 0.5rem" }}>
              {hasSequences(formState.sequences) && (
                <div className={styles.immunizationsInputContainer}>
                  <label htmlFor="sequence">{t("sequence", "Sequence")}</label>
                  <div className="omrs-select">
                    <select
                      id="sequence"
                      name="sequence"
                      value={formState.currentDose.sequenceNumber}
                      onChange={onDoseSelect}
                      className={`immunizationSequenceSelect`}
                      required
                    >
                      <option value="DEFAULT">
                        {t("please select", "Please select")}
                      </option>
                      {formState.sequences.map(s => {
                        return (
                          <option
                            key={s.sequenceNumber}
                            value={s.sequenceNumber}
                          >
                            {t(s.sequenceLabel, s.sequenceLabel)}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}
              <div className={styles.immunizationsInputContainer}>
                <label htmlFor="vaccinationDate">
                  {t("vaccination date", "Vaccination Date")}
                </label>
                <div className="omrs-datepicker">
                  <input
                    type="date"
                    name="vaccinationDate"
                    data-testid="vaccinationDateInput"
                    max={today}
                    required
                    defaultValue={formState.vaccinationDate}
                    onChange={evt =>
                      updateSingle("vaccinationDate", evt.target.value)
                    }
                  />
                  <svg className="omrs-icon" role="img">
                    <use xlinkHref="#omrs-icon-calendar"></use>
                  </svg>
                </div>
              </div>
              <div className={styles.immunizationsInputContainer}>
                <label htmlFor="vaccinationExpiration">
                  {t("expiration date", "Expiration Date")}
                </label>
                <div className="omrs-datepicker">
                  <input
                    type="date"
                    name="vaccinationExpiration"
                    data-testid="vaccinationExpirationInput"
                    defaultValue={formState.expirationDate}
                    onChange={evt =>
                      updateSingle("expirationDate", evt.target.value)
                    }
                  />
                  <svg className="omrs-icon" role="img">
                    <use xlinkHref="#omrs-icon-calendar"></use>
                  </svg>
                </div>
              </div>
              <div className={styles.immunizationsInputContainer}>
                <label htmlFor="lotNumber">
                  {t("lot number", "Lot Number")}
                </label>
                <div className="omrs-input-group">
                  <input
                    className="omrs-input-outlined"
                    type="text"
                    data-testid="lotNumberInput"
                    style={{ height: "2.75rem" }}
                    defaultValue={formState.lotNumber}
                    onChange={evt =>
                      updateSingle("lotNumber", evt.target.value)
                    }
                  />
                </div>
              </div>
              <div className={styles.immunizationsInputContainer}>
                <label htmlFor="manufacturer">
                  {t("manufacturer", "Manufacturer")}
                </label>
                <div className="omrs-input-group">
                  <input
                    className="omrs-input-outlined"
                    type="text"
                    data-testid="manufacturerInput"
                    style={{ height: "2.75rem" }}
                    defaultValue={formState.manufacturer}
                    onChange={evt =>
                      updateSingle("manufacturer", evt.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </SummaryCard>
        <div
          className={
            enableCreateButtons || enableEditButtons
              ? `${styles.buttonStyles} ${styles.buttonStylesBorder}`
              : styles.buttonStyles
          }
        >
          <button
            type="button"
            className="omrs-btn omrs-outlined-neutral omrs-rounded"
            style={{ width: "50%" }}
            onClick={closeForm}
          >
            {t("cancel", "Cancel")}
          </button>
          <button
            type="submit"
            style={{ width: "50%" }}
            className={
              enableCreateButtons || enableEditButtons
                ? "omrs-btn omrs-filled-action omrs-rounded"
                : "omrs-btn omrs-outlined omrs-rounded"
            }
            disabled={
              isViewEditMode ? !enableEditButtons : !enableCreateButtons
            }
          >
            {t("save", "Save")}
          </button>
        </div>
      </form>
    );
  }

  const closeForm = event => {
    let userConfirmed: boolean = false;
    const defaultConfirmMessage =
      "There is ongoing work, are you sure you want to close this tab?";
    const confirmMessage = t(
      "close form confirm message",
      defaultConfirmMessage
    );
    if (formState.formChanged) {
      userConfirmed = confirm(confirmMessage);
    }

    if (userConfirmed && formState.formChanged) {
      props.entryCancelled();
      history.push(`/patient/${patientUuid}/chart/immunizations`);
      props.closeComponent();
    } else if (!formState.formChanged) {
      props.entryCancelled();
      history.push(`/patient/${patientUuid}/chart/immunizations`);
      props.closeComponent();
    }
  };

  return <div>{createForm()}</div>;
}

ImmunizationsForm.defaultProps = {
  entryStarted: () => {},
  entryCancelled: () => {},
  entrySubmitted: () => {},
  closeComponent: () => {}
};

function hasSequences(sequences) {
  return sequences && sequences?.length > 0;
}

type ImmunizationsFormProps = DataCaptureComponentProps & {
  match: { params: ImmunizationFormData };
};

type ImmunizationFormState = {
  vaccineName: string;
  vaccineUuid: string;
  immunizationObsUuid: string;
  vaccinationDate: string;
  currentDose: ImmunizationSequence;
  sequences: Array<ImmunizationSequence>;
  expirationDate: string;
  lotNumber: string;
  manufacturer: string;
  formChanged: boolean;
};
