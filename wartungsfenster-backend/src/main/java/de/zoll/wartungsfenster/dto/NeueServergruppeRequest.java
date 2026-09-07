package de.zoll.wartungsfenster.dto;

import java.util.List;

public class NeueServergruppeRequest {
    public List<String> umgebungCodes;
    public String instanzName;
    public Long domainId;
    public String jbossAdmin;
    public String jiraKennzeichen;
    public String ansprechpartner;
    public String aufrufadresse;
    public String soaEndpunkte;
    public List<String> artefaktVorlagen;
}
