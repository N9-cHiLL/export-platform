/**
 * Canonical keys for required company documents — must match `company_documents.document_type`
 * in Postgres and docs/DATABASE_SCHEMA.md
 */
export const COMPANY_DOCUMENT_TYPE = {
	GST_CERTIFICATE: "gst_certificate",
	COMPANY_REGISTRATION_CERTIFICATE: "company_registration_certificate",
	COMPANY_PAN: "company_pan",
	AUTHORIZED_PERSON_AADHAAR: "authorized_person_aadhaar",
} as const;

export type CompanyDocumentTypeKey = (typeof COMPANY_DOCUMENT_TYPE)[keyof typeof COMPANY_DOCUMENT_TYPE];

export const COMPANY_DOCUMENT_REQUIREMENTS: ReadonlyArray<{
	key: CompanyDocumentTypeKey;
	label: string;
	description: string;
}> = [
	{
		key: COMPANY_DOCUMENT_TYPE.GST_CERTIFICATE,
		label: "GST certificate",
		description: "Upload your GST registration certificate.",
	},
	{
		key: COMPANY_DOCUMENT_TYPE.COMPANY_REGISTRATION_CERTIFICATE,
		label: "Company registration certificate",
		description: "Certificate of incorporation / registration.",
	},
	{
		key: COMPANY_DOCUMENT_TYPE.COMPANY_PAN,
		label: "PAN (company)",
		description: "Permanent Account Number card for the company.",
	},
	{
		key: COMPANY_DOCUMENT_TYPE.AUTHORIZED_PERSON_AADHAAR,
		label: "Aadhaar (authorised person)",
		description: "Aadhaar of the person authorised to act for the business.",
	},
];

export const SUBMISSION_KIND = {
	UPLOAD: "upload",
	APPLY_FOR_DOCUMENT: "apply_for_document",
} as const;

export type SubmissionKind = (typeof SUBMISSION_KIND)[keyof typeof SUBMISSION_KIND];
