"""
CURP format validator — extracts and validates all data encoded in the CURP.
No external API required; CURP structure is public knowledge (RENAPO spec).

CURP format: AAAA YYMMDD H/M EEECCN N
  [0:4]  Name code (4 letters)
  [4:6]  Year of birth (YY)
  [6:8]  Month of birth (MM)
  [8:10] Day of birth (DD)
  [10]   Sex: H=Hombre, M=Mujer
  [11:13] State code (2 letters)
  [13:16] Consonants from name (3)
  [16]   Homoclave digit
  [17]   Verification digit
"""
import re
from datetime import date

CURP_PATTERN = re.compile(
    r"^[A-Z]{4}\d{6}[HM]"
    r"(AS|BC|BS|CC|CH|CL|CM|CS|DF|DG|GR|GT|HG|JC|MC|MN|MS|NE|NL|NT|OC|PL|QR|QT|SL|SP|SR|TC|TL|TS|VZ|YN|ZS)"
    r"[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$"
)

ESTADOS = {
    "AS": "Aguascalientes", "BC": "Baja California", "BS": "Baja California Sur",
    "CC": "Campeche", "CH": "Chihuahua", "CL": "Colima", "CM": "Campeche",
    "CS": "Chiapas", "DF": "Ciudad de México", "DG": "Durango",
    "GR": "Guerrero", "GT": "Guanajuato", "HG": "Hidalgo",
    "JC": "Jalisco", "MC": "Estado de México", "MN": "Michoacán",
    "MS": "Morelos", "NE": "Nacido en el Extranjero", "NL": "Nuevo León",
    "NT": "Nayarit", "OC": "Oaxaca", "PL": "Puebla", "QR": "Quintana Roo",
    "QT": "Querétaro", "SL": "San Luis Potosí", "SP": "Sinaloa",
    "SR": "Sonora", "TC": "Tabasco", "TL": "Tlaxcala", "TS": "Tamaulipas",
    "VZ": "Veracruz", "YN": "Yucatán", "ZS": "Zacatecas",
}


def validate_curp(curp: str) -> dict:
    """
    Returns a dict with:
      valid: bool
      errors: list[str]
      data: dict (extracted data when valid)
    """
    curp = curp.strip().upper()
    errors = []

    if len(curp) != 18:
        return {"valid": False, "errors": [f"Longitud incorrecta: {len(curp)} caracteres (debe ser 18)"], "data": {}}

    if not CURP_PATTERN.match(curp):
        errors.append("Formato de CURP inválido")
        return {"valid": False, "errors": errors, "data": {}}

    # Extract encoded data
    yy = int(curp[4:6])
    mm = int(curp[6:8])
    dd = int(curp[8:10])
    sex_code = curp[10]
    state_code = curp[11:13]

    # Determine birth year (century heuristic)
    current_year = date.today().year % 100
    century = 1900 if yy > current_year else 2000
    birth_year = century + yy

    # Validate date
    try:
        birth_date = date(birth_year, mm, dd)
        age = (date.today() - birth_date).days // 365
        birth_str = birth_date.strftime("%d/%m/%Y")
    except ValueError:
        errors.append(f"Fecha de nacimiento inválida: {dd:02d}/{mm:02d}/{birth_year}")
        birth_str = f"{dd:02d}/{mm:02d}/{birth_year}"
        age = None
        birth_date = None

    data = {
        "fecha_nacimiento": birth_str,
        "edad_estimada": age,
        "sexo": "Masculino" if sex_code == "H" else "Femenino",
        "estado_nacimiento": ESTADOS.get(state_code, state_code),
        "codigo_estado": state_code,
    }

    if errors:
        return {"valid": False, "errors": errors, "data": data}

    # Age sanity check
    if age is not None and (age < 0 or age > 120):
        errors.append(f"Edad calculada fuera de rango: {age} años")

    return {"valid": len(errors) == 0, "errors": errors, "data": data}
