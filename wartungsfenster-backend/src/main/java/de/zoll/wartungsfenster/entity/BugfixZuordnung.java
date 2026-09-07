package de.zoll.wartungsfenster.entity;

import de.zoll.wartungsfenster.util.ColorMapConverter;
import jakarta.persistence.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "bugfix_zuordnung", uniqueConstraints = @UniqueConstraint(columnNames = {"instanz_id", "wartungsfenster_id"}))
public class BugfixZuordnung {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "instanz_id", nullable = false)
    private Instanz instanz;

    @ManyToOne(optional = false)
    @JoinColumn(name = "wartungsfenster_id", nullable = false)
    private Wartungsfenster wartungsfenster;

    @Column(name = "bugfix_nr")
    private String bugfixNr = "";

    @Enumerated(EnumType.STRING)
    private Properties properties = Properties.nein;

    @Column(name = "nexus_link")
    private String nexusLink = "";

    private String bemerkung = "";

    private boolean eingespielt = false;

    @Convert(converter = ColorMapConverter.class)
    @Column(name = "farben", columnDefinition = "json")
    private Map<String, String> farben = new LinkedHashMap<>();

    public enum Properties { ja, nein }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Instanz getInstanz() { return instanz; }
    public void setInstanz(Instanz instanz) { this.instanz = instanz; }

    public Wartungsfenster getWartungsfenster() { return wartungsfenster; }
    public void setWartungsfenster(Wartungsfenster wartungsfenster) { this.wartungsfenster = wartungsfenster; }

    public String getBugfixNr() { return bugfixNr; }
    public void setBugfixNr(String bugfixNr) { this.bugfixNr = bugfixNr; }

    public Properties getProperties() { return properties; }
    public void setProperties(Properties properties) { this.properties = properties; }

    public String getNexusLink() { return nexusLink; }
    public void setNexusLink(String nexusLink) { this.nexusLink = nexusLink; }

    public String getBemerkung() { return bemerkung; }
    public void setBemerkung(String bemerkung) { this.bemerkung = bemerkung; }

    public boolean isEingespielt() { return eingespielt; }
    public void setEingespielt(boolean eingespielt) { this.eingespielt = eingespielt; }

    public Map<String, String> getFarben() { return farben; }
    public void setFarben(Map<String, String> farben) { this.farben = farben; }
}
