package de.zoll.wartungsfenster.dto;

import java.util.Map;

public class BugfixZuordnungDto {
    public Long instanzId;
    public Long wartungsfensterId;
    public String bugfixNr;
    public String properties;   // "ja" | "nein"
    public String nexusLink;
    public String bemerkung;
    public boolean eingespielt;
    public Map<String, String> colors;
}
