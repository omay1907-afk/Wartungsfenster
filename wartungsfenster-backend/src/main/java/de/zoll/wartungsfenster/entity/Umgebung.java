package de.zoll.wartungsfenster.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "umgebung")
public class Umgebung {

    @Id
    private String code;

    private String bezeichnung;

    private String gruppe;

    private String farbe;

    private Integer sortierung;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getBezeichnung() { return bezeichnung; }
    public void setBezeichnung(String bezeichnung) { this.bezeichnung = bezeichnung; }

    public String getGruppe() { return gruppe; }
    public void setGruppe(String gruppe) { this.gruppe = gruppe; }

    public String getFarbe() { return farbe; }
    public void setFarbe(String farbe) { this.farbe = farbe; }

    public Integer getSortierung() { return sortierung; }
    public void setSortierung(Integer sortierung) { this.sortierung = sortierung; }
}
