export type DriverLicenseOcrResult = {
  last_name: string
  first_name: string
  license_number: string
  expiry_date: string
}

export async function parse_driver_license_image(_image_url: string) {
  void _image_url

  return {
    last_name: "",
    first_name: "",
    license_number: "",
    expiry_date: "",
  } satisfies DriverLicenseOcrResult
}
