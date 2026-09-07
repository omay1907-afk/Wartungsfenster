package de.zoll.wartungsfenster.dto;

import java.util.List;
import java.util.Map;

public class ServergruppeDto {
    public Long id;
    public Long instanzId;
    public String name;              // Instanzname
    public String umgebungCode;
    public Long domainId;            // entspricht domaene_id
    public String jbossAdmin;
    public String jiraKennzeichen;
    public String ansprechpartner;
    public String aufrufadresse;
    public String soaEndpunkte;
    public List<String> artefaktVorlagen;
    public Map<String, String> colors;
}
